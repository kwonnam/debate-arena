import { TelegramApiClient } from './api-client.js';
import { buildTelegramProgressScope, logTelegramProgress } from './progress-log.js';
import { loadEnvFileIfPresent, loadTelegramBotSettings } from './settings.js';
import { TelegramBotService } from './service.js';
import { extractTelegramMessage, type TelegramUpdate } from './types.js';

interface TelegramPollingArgs {
  timeoutSeconds: number;
  once: boolean;
}

function parseArgs(argv: string[]): TelegramPollingArgs {
  let timeoutSeconds = 30;
  let once = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--once') {
      once = true;
      continue;
    }
    if (arg === '--timeout' && argv[i + 1]) {
      timeoutSeconds = Math.max(1, Math.trunc(Number(argv[i + 1]) || 30));
      i += 1;
    }
  }

  return { timeoutSeconds, once };
}

function resolveDispatchChatId(settings: ReturnType<typeof loadTelegramBotSettings>, update: TelegramUpdate): number | null {
  const message = extractTelegramMessage(update);
  if (!message || message.chat.type !== 'private') {
    return null;
  }

  if (settings.allowedChatIds && !settings.allowedChatIds.has(message.chat.id)) {
    return null;
  }

  return message.chat.id;
}

async function processUpdate(settings: ReturnType<typeof loadTelegramBotSettings>, update: TelegramUpdate): Promise<void> {
  const service = new TelegramBotService(settings);
  service.validateConfiguration();
  await service.processUpdate(update);
}

function scheduleUpdateTask(
  settings: ReturnType<typeof loadTelegramBotSettings>,
  update: TelegramUpdate,
  activeTasks: Map<number, Promise<void>>,
): void {
  const scope = buildTelegramProgressScope(update);
  const chatId = resolveDispatchChatId(settings, update);
  if (chatId === null) {
    logTelegramProgress('DEBUG', 'update_skipped', scope, {
      reason: 'unsupported_chat_or_not_allowlisted',
    });
    return;
  }

  const previousTask = activeTasks.get(chatId);
  logTelegramProgress('INFO', 'update_scheduled', scope, {
    chatId,
    queuedBehindExistingTask: Boolean(previousTask),
  });
  let task: Promise<void>;
  task = (async () => {
    if (previousTask) {
      try {
        logTelegramProgress('DEBUG', 'waiting_for_previous_chat_task', scope, { chatId });
        await previousTask;
      } catch (error) {
        logTelegramProgress('WARN', 'previous_chat_task_failed', scope, {
          chatId,
          error,
        });
        console.error(`Previous Telegram task failed for chat ${chatId}:`, error);
      }
    }

    try {
      logTelegramProgress('INFO', 'update_processing_started', scope, { chatId });
      await processUpdate(settings, update);
      logTelegramProgress('INFO', 'update_processing_completed', scope, { chatId });
    } catch (error) {
      logTelegramProgress('ERROR', 'update_processing_failed', scope, {
        chatId,
        error,
      });
      console.error(`Telegram task failed for chat ${chatId}:`, error);
    } finally {
      if (activeTasks.get(chatId) === task) {
        activeTasks.delete(chatId);
      }
    }
  })();

  activeTasks.set(chatId, task);
}

async function drainActiveTasks(activeTasks: Map<number, Promise<void>>): Promise<void> {
  if (activeTasks.size === 0) {
    return;
  }

  await Promise.allSettled([...activeTasks.values()]);
}

export async function runTelegramPollingCli(argv: string[]): Promise<void> {
  loadEnvFileIfPresent();
  const args = parseArgs(argv);
  const settings = loadTelegramBotSettings();
  if (!settings.botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  logTelegramProgress('INFO', 'polling_started', {
    requestId: 'system-poller',
  }, {
    timeoutSeconds: args.timeoutSeconds,
    once: args.once,
    allowedChatIds: settings.allowedChatIds ? [...settings.allowedChatIds] : [],
  });

  const client = new TelegramApiClient(settings);
  const activeTasks = new Map<number, Promise<void>>();

  let offset: number | undefined;
  while (true) {
    try {
      const updates = await client.getUpdates({
        offset,
        timeout: args.timeoutSeconds,
        allowedUpdates: ['message', 'edited_message'],
      });

      for (const update of updates) {
        if (typeof update.update_id === 'number') {
          offset = update.update_id + 1;
        }
        scheduleUpdateTask(settings, update, activeTasks);
      }

      if (args.once) {
        await drainActiveTasks(activeTasks);
        logTelegramProgress('INFO', 'polling_completed_once', {
          requestId: 'system-poller',
        }, {
          pendingTaskCount: activeTasks.size,
        });
        return;
      }
    } catch (error) {
      logTelegramProgress('ERROR', 'polling_loop_failed', {
        requestId: 'system-poller',
      }, {
        error,
      });
      console.error('Telegram polling loop failed:', error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}
