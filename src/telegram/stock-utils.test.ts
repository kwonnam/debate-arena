import { describe, expect, it } from 'vitest';
import { buildStockNewsQuery, extractTickerCandidates, isLikelyStockQuestion, normalizeQuestion, resolveResponseLanguage } from './stock-utils.js';

describe('telegram stock utils', () => {
  it('extracts unique ticker candidates from a question', () => {
    expect(extractTickerCandidates('Should I buy NVDA or TSLA after NVDA earnings?')).toEqual(['NVDA', 'TSLA']);
  });

  it('builds a stock news query with ticker context when available', () => {
    expect(buildStockNewsQuery('/debate NVDA 실적 발표 후 주가 전망')).toBe('NVDA stock NVDA 실적 발표 후 주가 전망');
  });

  it('normalizes commands and whitespace', () => {
    expect(normalizeQuestion('/debate   Is   AAPL   overvalued?')).toBe('Is AAPL overvalued?');
  });

  it('resolves Korean response language from text', () => {
    expect(resolveResponseLanguage('삼성전자 주가 전망', undefined, 'auto')).toBe('ko');
  });

  it('detects general questions as non-stock questions', () => {
    expect(isLikelyStockQuestion('파이썬에서 데코레이터가 뭐야?')).toBe(false);
  });

  it('detects stock keywords without a ticker', () => {
    expect(isLikelyStockQuestion('테슬라 주가 전망이 어때?')).toBe(true);
  });
});
