import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer } from 'ws';
import { WebAiBridgeProvider } from './web-ai-bridge.js';
import type { Message } from './types.js';

const TEST_MESSAGES: Message[] = [
  {
    role: 'system',
    content: 'You are a careful debate participant.',
  },
  {
    role: 'user',
    content: 'Argue for using a browser-driven provider.',
  },
];

const servers = new Set<WebSocketServer>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
              return;
            }
            resolve();
          });
        }),
    ),
  );
  servers.clear();
});

describe('WebAiBridgeProvider', () => {
  it('streams delta chunks from the bridge protocol', async () => {
    const server = new WebSocketServer({ port: 0 });
    servers.add(server);

    server.on('connection', (socket) => {
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as {
          type: string;
          role?: string;
          requestId?: string;
          prompt?: string;
        };

        if (message.type === 'hello') {
          socket.send(
            JSON.stringify({
              type: 'bridge:status',
              extensionConnected: true,
            }),
          );
          return;
        }

        if (message.type === 'cli:prompt') {
          expect(message.prompt).toContain('You are a careful debate participant.');
          expect(message.prompt).toContain('Argue for using a browser-driven provider.');

          socket.send(
            JSON.stringify({
              type: 'request:accepted',
              requestId: message.requestId,
            }),
          );
          socket.send(
            JSON.stringify({
              type: 'assistant:chunk',
              requestId: message.requestId,
              text: 'Hello',
            }),
          );
          socket.send(
            JSON.stringify({
              type: 'assistant:chunk',
              requestId: message.requestId,
              text: 'Hello from the bridge',
            }),
          );
          socket.send(
            JSON.stringify({
              type: 'assistant:done',
              requestId: message.requestId,
              text: 'Hello from the bridge!',
            }),
          );
        }
      });
    });

    const { port } = server.address() as { port: number };
    const provider = new WebAiBridgeProvider('grok-web', `ws://127.0.0.1:${port}`, 2000);

    const chunks: string[] = [];
    for await (const chunk of provider.stream(TEST_MESSAGES)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' from the bridge', '!']);
    await expect(provider.generate(TEST_MESSAGES)).resolves.toBe('Hello from the bridge!');
  });

  it('fails fast when no extension is attached to the bridge', async () => {
    const server = new WebSocketServer({ port: 0 });
    servers.add(server);

    server.on('connection', (socket) => {
      socket.on('message', (raw) => {
        const message = JSON.parse(raw.toString()) as { type: string };
        if (message.type === 'hello') {
          socket.send(
            JSON.stringify({
              type: 'bridge:status',
              extensionConnected: false,
            }),
          );
        }
      });
    });

    const { port } = server.address() as { port: number };
    const provider = new WebAiBridgeProvider(`web-${randomUUID()}`, `ws://127.0.0.1:${port}`, 2000);

    await expect(provider.generate(TEST_MESSAGES)).rejects.toThrow(
      'No extension is connected. Open the extension popup and attach the active AI tab first.',
    );
  });
});
