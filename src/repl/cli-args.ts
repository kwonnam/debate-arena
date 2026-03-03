export interface CliArgs {
  news?: boolean;
  newsQuiet?: boolean;
  newsSnapshot?: string;
  newsMode?: 'unified' | 'split';
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
    } else if (!arg.startsWith('--')) {
      args.question = argv.slice(i).join(' ');
      break;
    }
  }
  return args;
}
