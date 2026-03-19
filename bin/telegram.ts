import { runTelegramPollingCli } from '../src/telegram/polling.js';

try {
  await runTelegramPollingCli(process.argv.slice(2));
} catch (error) {
  console.error(error);
  process.exit(1);
}
