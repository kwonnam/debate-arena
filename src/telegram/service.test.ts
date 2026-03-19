import { describe, expect, it } from 'vitest';
import { parseTelegramCommand } from './service.js';

describe('telegram service command parsing', () => {
  it('parses template selection commands', () => {
    expect(parseTelegramCommand('/template news-stock-event-reaction')).toEqual({
      kind: 'template-set',
      templateId: 'news-stock-event-reaction',
    });
  });

  it('parses plain-text stock questions as debate requests', () => {
    expect(parseTelegramCommand('NVDA 지금 매수해도 될까?')).toEqual({
      kind: 'debate',
      question: 'NVDA 지금 매수해도 될까?',
    });
  });

  it('parses plain-text general questions as chat requests', () => {
    expect(parseTelegramCommand('파이썬에서 데코레이터가 뭐야?')).toEqual({
      kind: 'chat',
      question: '파이썬에서 데코레이터가 뭐야?',
    });
  });

  it('parses missing debate arguments as usage requests', () => {
    expect(parseTelegramCommand('/debate')).toEqual({ kind: 'debate-usage' });
  });

  it('parses /chat with arguments as general chat requests', () => {
    expect(parseTelegramCommand('/chat Rust와 Go의 차이를 설명해줘')).toEqual({
      kind: 'chat',
      question: 'Rust와 Go의 차이를 설명해줘',
    });
  });

  it('parses missing chat arguments as usage requests', () => {
    expect(parseTelegramCommand('/chat')).toEqual({ kind: 'chat-usage' });
  });
});
