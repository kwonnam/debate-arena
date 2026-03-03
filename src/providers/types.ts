export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  name?: string;
  kind: 'text' | 'image';
  mimeType?: string;
  content: string;
}

export interface AIProvider {
  readonly name: string;
  generate(messages: Message[]): Promise<string>;
  stream(messages: Message[], signal?: AbortSignal, cwd?: string): AsyncIterable<string>;
}
