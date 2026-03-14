import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { AIProvider, Message } from './types.js';
import { ProviderTimeoutError } from './errors.js';
import { renderMessages } from './prompt-renderer.js';

type BridgeMessage = {
  type?: string;
  requestId?: string | null;
  text?: string;
  error?: string;
  extensionConnected?: boolean;
};

export class WebAiBridgeProvider implements AIProvider {
  readonly name: string;
  private bridgeUrl: string;
  private timeoutMs: number;

  constructor(name: string, bridgeUrl: string, timeoutMs: number) {
    this.name = name;
    this.bridgeUrl = bridgeUrl;
    this.timeoutMs = timeoutMs;
  }

  async generate(messages: Message[]): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.stream(messages)) {
      chunks.push(chunk);
    }
    return chunks.join('').trim();
  }

  async *stream(messages: Message[], signal?: AbortSignal): AsyncIterable<string> {
    const prompt = renderMessages(messages);
    const requestId = randomUUID();
    const socket = await openSocket(this.bridgeUrl);

    let resolver: (() => void) | null = null;
    let latestText = '';
    let done = false;
    let connected = false;
    let ready = false;
    let timedOut = false;
    let aborted = false;
    let closeExpected = false;
    let fatalError: Error | null = null;
    const queue: string[] = [];

    const notify = () => {
      if (resolver) {
        resolver();
        resolver = null;
      }
    };

    const finishWithError = (error: Error) => {
      if (fatalError || done) {
        return;
      }
      fatalError = error;
      done = true;
      notify();
    };

    const finishSuccessfully = () => {
      if (done) {
        return;
      }
      done = true;
      notify();
    };

    const emitDelta = (nextText: string | undefined) => {
      const normalized = nextText ?? '';
      const delta = normalized.startsWith(latestText)
        ? normalized.slice(latestText.length)
        : normalized;

      latestText = normalized;

      if (delta) {
        queue.push(delta);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      socket.off('message', handleMessage);
      socket.off('close', handleClose);
      socket.off('error', handleError);
      if (signal) {
        signal.removeEventListener('abort', handleAbort);
      }
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        closeExpected = true;
        socket.close();
      }
    };

    const handleAbort = () => {
      aborted = true;
      done = true;
      closeExpected = true;
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
      notify();
    };

    const handleMessage = (data: WebSocket.RawData) => {
      const message = parseBridgeMessage(data);
      if (!message?.type) {
        return;
      }

      switch (message.type) {
        case 'bridge:status':
          connected = Boolean(message.extensionConnected);
          ready = true;
          notify();
          return;

        case 'request:accepted':
          return;

        case 'assistant:chunk':
          if (message.requestId !== requestId) {
            return;
          }
          emitDelta(message.text);
          notify();
          return;

        case 'assistant:done':
          if (message.requestId !== requestId) {
            return;
          }
          emitDelta(message.text);
          finishSuccessfully();
          return;

        case 'assistant:error':
        case 'bridge:error':
          if (message.requestId && message.requestId !== requestId) {
            return;
          }
          finishWithError(new Error(message.error || 'Bridge request failed.'));
          return;

        case 'extension:status':
          return;

        default:
          return;
      }
    };

    const handleClose = () => {
      if (closeExpected) {
        return;
      }
      if (!ready) {
        finishWithError(new Error(`Could not connect to Web AI bridge at ${this.bridgeUrl}.`));
        return;
      }
      if (!done) {
        finishWithError(new Error('The Web AI bridge connection closed unexpectedly.'));
      }
    };

    const handleError = () => {
      if (!ready) {
        finishWithError(new Error(`Could not connect to Web AI bridge at ${this.bridgeUrl}.`));
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      done = true;
      closeExpected = true;
      socket.close();
      notify();
    }, this.timeoutMs);

    socket.on('message', handleMessage);
    socket.on('close', handleClose);
    socket.on('error', handleError);

    if (signal) {
      if (signal.aborted) {
        handleAbort();
      } else {
        signal.addEventListener('abort', handleAbort, { once: true });
      }
    }

    socket.send(
      JSON.stringify({
        type: 'hello',
        role: 'cli',
      }),
    );

    try {
      while (!ready && !fatalError && !done) {
        await waitForNextSignal((nextResolver) => {
          resolver = nextResolver;
        });
      }

      if (fatalError) {
        throw fatalError;
      }
      if (timedOut) {
        throw new ProviderTimeoutError(
          `Web AI bridge timed out after ${this.timeoutMs}ms while waiting for initial status: ${this.bridgeUrl}`,
          this.timeoutMs,
        );
      }
      if (aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }
      if (!connected) {
        throw new Error('No extension is connected. Open the extension popup and attach the active AI tab first.');
      }

      socket.send(
        JSON.stringify({
          type: 'cli:prompt',
          requestId,
          prompt,
        }),
      );

      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          await waitForNextSignal((nextResolver) => {
            resolver = nextResolver;
          });
          continue;
        }

        while (queue.length > 0) {
          yield queue.shift() as string;
        }
      }
    } finally {
      cleanup();
    }

    if (timedOut) {
      throw new ProviderTimeoutError(
        `Web AI bridge timed out after ${this.timeoutMs}ms: ${this.bridgeUrl}`,
        this.timeoutMs,
      );
    }

    if (aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    if (fatalError) {
      throw fatalError;
    }
  }
}

function parseBridgeMessage(data: WebSocket.RawData): BridgeMessage | null {
  try {
    return JSON.parse(data.toString()) as BridgeMessage;
  } catch {
    return null;
  }
}

function openSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    const handleOpen = () => {
      socket.off('error', handleError);
      resolve(socket);
    };

    const handleError = () => {
      socket.off('open', handleOpen);
      reject(new Error(`Could not connect to Web AI bridge at ${url}.`));
    };

    socket.once('open', handleOpen);
    socket.once('error', handleError);
  });
}

function waitForNextSignal(assignResolver: (resolve: () => void) => void): Promise<void> {
  return new Promise<void>((resolve) => {
    assignResolver(resolve);
  });
}
