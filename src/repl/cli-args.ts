import type { SearchLanguageScope } from '../news/search-plan.js';

export interface CliArgs {
  news?: boolean;
  newsQuiet?: boolean;
  newsSnapshot?: string;
  newsMode?: 'unified' | 'split';
  newsQueryTransformMode?: 'off' | 'expand';
  newsQueryLanguageScope?: SearchLanguageScope;
  web?: boolean;
  webQuiet?: boolean;
  webSnapshot?: string;
  webMode?: 'unified' | 'split';
  webQueryTransformMode?: 'off' | 'expand';
  webQueryLanguageScope?: SearchLanguageScope;
  question?: string;
}

export function parseCliArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--news') {
      args.news = true;
    } else if (arg === '--news-quiet') {
      args.newsQuiet = true;
    } else if (arg === '--news-snapshot' && argv[i + 1]) {
      args.newsSnapshot = argv[++i];
    } else if (arg === '--news-mode' && (argv[i + 1] === 'unified' || argv[i + 1] === 'split')) {
      args.newsMode = argv[++i] as 'unified' | 'split';
    } else if (arg === '--news-query-expand') {
      args.newsQueryTransformMode = 'expand';
    } else if (arg === '--news-query-languages' && isSearchLanguageScope(argv[i + 1])) {
      args.newsQueryLanguageScope = argv[++i] as SearchLanguageScope;
    } else if (arg === '--web') {
      args.web = true;
    } else if (arg === '--web-quiet') {
      args.webQuiet = true;
    } else if (arg === '--web-snapshot' && argv[i + 1]) {
      args.webSnapshot = argv[++i];
    } else if (arg === '--web-mode' && (argv[i + 1] === 'unified' || argv[i + 1] === 'split')) {
      args.webMode = argv[++i] as 'unified' | 'split';
    } else if (arg === '--web-query-expand') {
      args.webQueryTransformMode = 'expand';
    } else if (arg === '--web-query-languages' && isSearchLanguageScope(argv[i + 1])) {
      args.webQueryLanguageScope = argv[++i] as SearchLanguageScope;
    } else if (!arg.startsWith('--')) {
      args.question = argv.slice(i).join(' ');
      break;
    }
  }
  return args;
}

function isSearchLanguageScope(value: unknown): value is SearchLanguageScope {
  return value === 'input' || value === 'ko' || value === 'en' || value === 'both';
}
