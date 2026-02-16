export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIProvider {
  readonly name: string;
  generate(messages: Message[]): Promise<string>;
  stream(messages: Message[]): AsyncIterable<string>;
}
