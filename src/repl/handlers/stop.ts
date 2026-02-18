import { execSync } from 'node:child_process';
import { readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { resetTTYInputState } from '../tty-state.js';

interface ProcessInfo {
  readonly pid: number;
  readonly command: string;
}

const isWindows = process.platform === 'win32';

function findProcesses(): ProcessInfo[] {
  try {
    return isWindows ? findProcessesWindows() : findProcessesUnix();
  } catch {
    return [];
  }
}

function findProcessesWindows(): ProcessInfo[] {
  const ps = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*fight-for-me*' -and $_.CommandLine -notlike '*Get-CimInstance*' -and $_.CommandLine -notlike '*fight-for-me stop*' -and $_.CommandLine -notlike '*shell-snapshots*' } | Select-Object ProcessId, CommandLine | ConvertTo-Json`;
  const raw = execSync(`powershell -NoProfile -Command "${ps}"`, {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 10000,
  }).trim();

  if (!raw) return [];

  const parsed: unknown = JSON.parse(raw);
  const entries = Array.isArray(parsed) ? parsed : [parsed];

  return entries
    .filter((e: { ProcessId: number }) => e.ProcessId !== process.pid)
    .map((e: { ProcessId: number; CommandLine: string }) => ({
      pid: e.ProcessId,
      command: e.CommandLine,
    }));
}

function findProcessesUnix(): ProcessInfo[] {
  const raw = execSync('ps aux', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  });

  return raw
    .split('\n')
    .filter(
      (line) =>
        line.includes('fight-for-me') &&
        line.includes('node') &&
        !line.includes('grep') &&
        !line.includes('fight-for-me stop'),
    )
    .map((line) => {
      const parts = line.trim().split(/\s+/);
      const pid = Number(parts[1]);
      const command = parts.slice(10).join(' ');
      return { pid, command };
    })
    .filter((p) => p.pid !== process.pid && !Number.isNaN(p.pid));
}

function killProcess(pid: number, force: boolean): boolean {
  try {
    if (isWindows) {
      execSync(`taskkill /F /PID ${pid}`, {
        stdio: 'ignore',
        timeout: 5000,
      });
    } else {
      process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
    }
    return true;
  } catch {
    return false;
  }
}

function cleanupTempFiles(): number {
  const dir = tmpdir();
  let cleaned = 0;

  try {
    const files = readdirSync(dir);
    for (const file of files) {
      if (file.startsWith('fight-for-me-') && file.endsWith('.txt')) {
        try {
          unlinkSync(join(dir, file));
          cleaned++;
        } catch {
          // File may be locked; skip.
        }
      }
    }
  } catch {
    // Cannot read tmpdir; skip cleanup.
  }

  return cleaned;
}

export function handleStop(args: string): void {
  try {
    resetTTYInputState();

    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');

    const processes = findProcesses();

    if (processes.length === 0) {
      console.log(`\n  ${chalk.blue('Info')} No running fight-for-me processes found.\n`);
      return;
    }

    console.log(`\n  Found ${processes.length} process(es):\n`);
    for (const p of processes) {
      console.log(`  PID ${chalk.bold(String(p.pid))}  ${p.command}`);
    }
    console.log('');

    if (dryRun) {
      console.log(`  ${chalk.yellow('dry-run')} - no processes were stopped.\n`);
      return;
    }

    let stopped = 0;
    for (const p of processes) {
      if (killProcess(p.pid, force)) {
        stopped++;
      }
    }

    const cleaned = cleanupTempFiles();

    console.log(`  ${chalk.green('OK')} Stopped ${stopped} process(es).`);
    if (cleaned > 0) {
      console.log(`  Cleaned up ${cleaned} orphaned temp file(s).`);
    }
    console.log('');
  } finally {
    resetTTYInputState();
  }
}
