import { execSync } from 'node:child_process';
import { readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import chalk from 'chalk';
import { resetTTYInputState } from '../tty-state.js';
import { getDashboardRuntimeStatus, stopDashboardRuntime } from '../../server/index.js';

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
  const ps = `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*debate-arena*' -and $_.CommandLine -notlike '*Get-CimInstance*' -and $_.CommandLine -notlike '*debate-arena stop*' -and $_.CommandLine -notlike '*shell-snapshots*' } | Select-Object ProcessId, CommandLine | ConvertTo-Json`;
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
        line.includes('debate-arena') &&
        line.includes('node') &&
        !line.includes('grep') &&
        !line.includes('debate-arena stop'),
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
      if (file.startsWith('debate-arena-') && file.endsWith('.txt')) {
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

    const normalizedArgs = args.trim().toLowerCase();
    const teamMode = normalizedArgs === 'team';

    if (teamMode) {
      const before = getDashboardRuntimeStatus();
      const result = stopDashboardRuntime({ stopServer: true, reason: 'user_cancelled' });
      const after = getDashboardRuntimeStatus();

      console.log(`\n  ${chalk.green('OK')} Team stop complete.`);
      console.log(`  Running sessions: ${before.runningSessionCount} -> ${after.runningSessionCount}`);
      console.log(`  Dashboard server: ${before.serverRunning ? 'running' : 'stopped'} -> ${after.serverRunning ? 'running' : 'stopped'}`);
      console.log(`  Cancelled sessions: ${result.stoppedSessions}`);
      console.log('');
      return;
    }

    const force = args.includes('--force');
    const dryRun = args.includes('--dry-run');

    const before = getDashboardRuntimeStatus();
    const localStop = dryRun
      ? { stoppedSessions: 0, serverStopped: false }
      : stopDashboardRuntime({ stopServer: true, reason: 'user_cancelled' });
    const after = getDashboardRuntimeStatus();

    const processes = findProcesses();

    if (processes.length === 0 && localStop.stoppedSessions === 0 && !localStop.serverStopped) {
      console.log(`\n  ${chalk.blue('Info')} No running debate-arena processes found.\n`);
      return;
    }

    if (before.serverRunning || before.runningSessionCount > 0) {
      if (dryRun) {
        console.log(`\n  ${chalk.yellow('dry-run')} - local dashboard runtime would be stopped.`);
        console.log(`  sessions: ${before.runningSessionCount}, serverRunning: ${before.serverRunning}\n`);
      } else {
        console.log(`\n  ${chalk.green('OK')} Stopped local dashboard runtime.`);
        console.log(`  Sessions cancelled: ${localStop.stoppedSessions}`);
        console.log(`  Dashboard server stopped: ${localStop.serverStopped ? 'yes' : 'no'}\n`);
      }
    } else if (!dryRun && (after.serverRunning || after.runningSessionCount > 0)) {
      console.log(`\n  ${chalk.yellow('Warn')} Local dashboard runtime is still active.\n`);
    }

    if (processes.length > 0) {
      console.log(`\n  Found ${processes.length} process(es):\n`);
      for (const p of processes) {
        console.log(`  PID ${chalk.bold(String(p.pid))}  ${p.command}`);
      }
      console.log('');
    }

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
