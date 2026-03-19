import { startRepl } from '../src/repl/index.js';
import { parseCliArgs } from '../src/repl/cli-args.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const replOnly = argv.includes('--repl');
  const normalizedArgv = argv.filter((arg) => arg !== '--repl');

  if (shouldStartDashboard(normalizedArgv, replOnly)) {
    const { startDashboardServer, stopDashboardRuntime } = await import('../src/server/index.js');
    const { url } = startDashboardServer();

    console.log(`\n  Dashboard running at ${url}\n`);
    console.log('  Press Ctrl+C to stop the local bridge server.\n');

    let shuttingDown = false;
    const shutdown = () => {
      if (shuttingDown) return;
      shuttingDown = true;
      stopDashboardRuntime({ stopServer: true, reason: 'server_shutdown' });
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    return;
  }

  const cliArgs = parseCliArgs(normalizedArgv);
  await startRepl(cliArgs);
}

function shouldStartDashboard(argv: string[], replOnly: boolean): boolean {
  if (replOnly) return false;
  if (argv.length === 0) return true;
  return argv.includes('--dashboard') || argv.includes('--server') || argv.includes('--serve');
}

void main();
