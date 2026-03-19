const COMMAND_PREFIX_RE = /^\/[a-z_]+(?:@[a-z0-9_]+)?\s*/i;
const TICKER_RE = /\b[A-Z]{1,5}(?:\.[A-Z])?\b/g;
const TICKER_STOPWORDS = new Set([
  'A',
  'AI',
  'CEO',
  'ETF',
  'GDP',
  'IPO',
  'IRA',
  'IT',
  'NOW',
  'RISK',
  'THE',
  'TO',
  'US',
  'USA',
]);
const STOCK_KEYWORD_RE = /\b(stock|stocks|share price|shares|ticker|earnings|guidance|valuation|bullish|bearish|buy|sell|hold|nasdaq|nyse|market cap)\b/i;
const STOCK_KEYWORD_KO_RE = /(주가|종목|매수|매도|보유|실적|가이던스|밸류|밸류에이션|시총|상승|하락|증시|주식)/;

export type TelegramResponseLanguage = 'ko' | 'en';

export function normalizeQuestion(text: string): string {
  return String(text ?? '')
    .replace(COMMAND_PREFIX_RE, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractTickerCandidates(text: string): string[] {
  const matches = normalizeQuestion(text).match(TICKER_RE) ?? [];
  const seen = new Set<string>();
  const tickers: string[] = [];

  for (const raw of matches) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker || TICKER_STOPWORDS.has(ticker) || ticker.length < 2) {
      continue;
    }
    if (seen.has(ticker)) {
      continue;
    }
    seen.add(ticker);
    tickers.push(ticker);
  }

  return tickers;
}

export function buildStockNewsQuery(question: string): string {
  const normalized = normalizeQuestion(question);
  if (!normalized) {
    return '';
  }

  const tickers = extractTickerCandidates(normalized);
  if (tickers.length === 0) {
    return normalized;
  }

  return `${tickers.join(' ')} stock ${normalized}`;
}

export function isLikelyStockQuestion(question: string): boolean {
  const normalized = normalizeQuestion(question);
  if (!normalized) {
    return false;
  }

  if (extractTickerCandidates(normalized).length > 0) {
    return true;
  }

  return STOCK_KEYWORD_RE.test(normalized) || STOCK_KEYWORD_KO_RE.test(normalized);
}

export function resolveResponseLanguage(
  question: string,
  userLanguageCode?: string,
  override?: 'auto' | TelegramResponseLanguage,
): TelegramResponseLanguage {
  if (override === 'ko' || override === 'en') {
    return override;
  }

  if (/[가-힣]/.test(question) || String(userLanguageCode ?? '').toLowerCase().startsWith('ko')) {
    return 'ko';
  }

  return 'en';
}
