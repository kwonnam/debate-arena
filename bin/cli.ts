import { startRepl } from '../src/repl/index.js';
import { parseCliArgs } from '../src/repl/cli-args.js';

const cliArgs = parseCliArgs(process.argv.slice(2));
startRepl(cliArgs);
