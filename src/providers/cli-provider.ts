import type { AIProvider, Message } from './types.js';
import { runCommandStream } from './cli-runner.js';

export class CliProvider implements AIProvider {
  readonly name: string;
  private command: string;
  private timeoutMs: number;

  constructor(name: string, command: string, timeoutMs: number) {
    this.name = name;
    this.command = command;
    this.timeoutMs = timeoutMs;
  }

  async generate(messages: Message[]): Promise<string> {
    const chunks: string[] = [];
    for await (const chunk of this.stream(messages)) {
      chunks.push(chunk);
    }
    return chunks.join('').trim();
  }

  stream(messages: Message[], signal?: AbortSignal, cwd?: string): AsyncIterable<string> {
    return runCommandStream(this.command, messages, this.timeoutMs, signal, cwd);
  }
}
