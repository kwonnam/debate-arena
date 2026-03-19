import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface TelegramChatPreference {
  templateId?: string;
  updatedAt: string;
}

interface TelegramChatStateDocument {
  version: 1;
  chats: Record<string, TelegramChatPreference>;
}

const EMPTY_STATE: TelegramChatStateDocument = {
  version: 1,
  chats: {},
};

function readState(filePath: string): TelegramChatStateDocument {
  if (!existsSync(filePath)) {
    return { ...EMPTY_STATE, chats: {} };
  }

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as TelegramChatStateDocument;
    if (parsed.version !== 1 || !parsed.chats || typeof parsed.chats !== 'object') {
      return { ...EMPTY_STATE, chats: {} };
    }
    return {
      version: 1,
      chats: { ...parsed.chats },
    };
  } catch {
    return { ...EMPTY_STATE, chats: {} };
  }
}

export class TelegramChatStateStore {
  private state: TelegramChatStateDocument;

  constructor(private readonly filePath: string) {
    this.state = readState(filePath);
  }

  getTemplateId(chatId: number): string | undefined {
    return this.state.chats[String(chatId)]?.templateId;
  }

  setTemplateId(chatId: number, templateId: string): void {
    this.state.chats[String(chatId)] = {
      templateId,
      updatedAt: new Date().toISOString(),
    };
    this.persist();
  }

  private persist(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.state, null, 2)}\n`, 'utf-8');
  }
}
