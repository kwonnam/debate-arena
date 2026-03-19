import { DEFAULT_NEWS_CONFIG, type NewsConfig } from '../config/defaults.js';
import { loadConfigV2 } from '../config/manager.js';
import { DebateOrchestrator } from '../core/orchestrator.js';
import { collectEvidence } from '../news/index.js';
import { createProviderMap } from '../providers/factory.js';
import { createSilentCallbacks } from '../ui/renderer.js';
import { TelegramApiClient } from './api-client.js';
import { generateGeneralChatReply } from './chat.js';
import { TelegramChatStateStore } from './chat-state.js';
import { TelegramFormatter } from './formatter.js';
import { buildTelegramProgressScope, logTelegramProgress } from './progress-log.js';
import type { TelegramBotSettings } from './settings.js';
import { buildStockNewsQuery, isLikelyStockQuestion, normalizeQuestion, resolveResponseLanguage } from './stock-utils.js';
import { buildTemplateParticipants, listStockTemplates, resolveDefaultStockTemplateId, resolveStockTemplate } from './template-resolver.js';
import { extractTelegramMessage, type TelegramMessage, type TelegramUpdate } from './types.js';
import { summarizeTelegramVerdict } from './verdict.js';

type ParsedTelegramCommand =
  | { kind: 'help' }
  | { kind: 'templates' }
  | { kind: 'template-status' }
  | { kind: 'template-set'; templateId: string }
  | { kind: 'status' }
  | { kind: 'debate'; question: string }
  | { kind: 'debate-usage' }
  | { kind: 'chat'; question: string }
  | { kind: 'chat-usage' }
  | { kind: 'unknown'; command: string };

function normalizeSlashCommand(command: string): string {
  return command.replace(/^\/+/, '').replace(/@[^@\s]+$/, '').trim().toLowerCase();
}

export function parseTelegramCommand(text: string): ParsedTelegramCommand {
  const trimmed = String(text ?? '').trim();
  if (!trimmed.startsWith('/')) {
    const question = normalizeQuestion(trimmed);
    if (isLikelyStockQuestion(question)) {
      return { kind: 'debate', question };
    }
    return { kind: 'chat', question };
  }

  const [rawCommand, ...rest] = trimmed.split(/\s+/);
  const command = normalizeSlashCommand(rawCommand);
  const args = rest.join(' ').trim();

  if (command === 'start' || command === 'help') {
    return { kind: 'help' };
  }
  if (command === 'templates') {
    return { kind: 'templates' };
  }
  if (command === 'template') {
    if (!args) {
      return { kind: 'template-status' };
    }
    if (args.toLowerCase() === 'list') {
      return { kind: 'templates' };
    }
    return { kind: 'template-set', templateId: args };
  }
  if (command === 'status') {
    return { kind: 'status' };
  }
  if (command === 'debate' || command === 'analyze') {
    if (!args) {
      return { kind: 'debate-usage' };
    }
    return { kind: 'debate', question: normalizeQuestion(args) };
  }
  if (command === 'chat' || command === 'ask') {
    if (!args) {
      return { kind: 'chat-usage' };
    }
    return { kind: 'chat', question: normalizeQuestion(args) };
  }

  return { kind: 'unknown', command };
}

export class TelegramBotService {
  private readonly client: TelegramApiClient;
  private readonly stateStore: TelegramChatStateStore;
  private readonly newsConfig: NewsConfig;

  constructor(
    private readonly settings: TelegramBotSettings,
    deps: {
      client?: TelegramApiClient;
      stateStore?: TelegramChatStateStore;
      newsConfig?: NewsConfig;
    } = {},
  ) {
    this.client = deps.client ?? new TelegramApiClient(settings);
    this.stateStore = deps.stateStore ?? new TelegramChatStateStore(settings.stateFile);
    this.newsConfig = deps.newsConfig ?? loadConfigV2().news ?? DEFAULT_NEWS_CONFIG;
  }

  validateConfiguration(): void {
    if (!this.settings.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
    }
  }

  async processUpdate(update: TelegramUpdate): Promise<void> {
    const message = extractTelegramMessage(update);
    const text = String(message?.text ?? '').trim();
    const scope = buildTelegramProgressScope(update);

    if (!message || !text) {
      logTelegramProgress('DEBUG', 'update_ignored_empty', scope, {});
      return;
    }

    const rejectionReason = this.getChatRejectionReason(message);
    if (rejectionReason) {
      logTelegramProgress('WARN', 'update_ignored', scope, {
        reason: rejectionReason,
        chatType: message.chat.type,
      });
      return;
    }

    const currentTemplate = this.getCurrentTemplate(message.chat.id);
    const language = resolveResponseLanguage(text, message.from?.language_code, this.settings.responseLanguage);
    const formatter = new TelegramFormatter(language);
    const parsed = parseTelegramCommand(text);
    logTelegramProgress('INFO', 'command_parsed', scope, {
      kind: parsed.kind,
      templateId: currentTemplate.id,
      questionPreview: text.slice(0, 160),
    });

    switch (parsed.kind) {
      case 'help':
        await this.client.sendMessage(message.chat.id, formatter.formatHelp(currentTemplate));
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
        });
        return;

      case 'templates':
        await this.client.sendMessage(
          message.chat.id,
          formatter.formatTemplateList(currentTemplate.id, listStockTemplates()),
        );
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
        });
        return;

      case 'template-status':
        await this.client.sendMessage(message.chat.id, formatter.formatTemplateStatus(currentTemplate));
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
          templateId: currentTemplate.id,
        });
        return;

      case 'template-set': {
        const normalizedTemplateId = parsed.templateId.toLowerCase() === 'default'
          ? resolveDefaultStockTemplateId(this.settings.defaultTemplateId)
          : parsed.templateId.trim();

        try {
          const template = resolveStockTemplate(normalizedTemplateId);
          this.stateStore.setTemplateId(message.chat.id, template.id);
          await this.client.sendMessage(message.chat.id, formatter.formatTemplateChanged(template));
          logTelegramProgress('INFO', 'template_updated', scope, {
            templateId: template.id,
          });
        } catch {
          await this.client.sendMessage(
            message.chat.id,
            formatter.formatUnknownTemplate(normalizedTemplateId, listStockTemplates()),
          );
          logTelegramProgress('WARN', 'template_update_failed', scope, {
            templateId: normalizedTemplateId,
          });
        }
        return;
      }

      case 'status':
        await this.client.sendMessage(
          message.chat.id,
          formatter.formatStatus(
            currentTemplate,
            this.settings.ollamaProviderIds,
            this.settings.judgeProviderId,
            this.settings.rounds,
          ),
        );
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
          templateId: currentTemplate.id,
          judgeProviderId: this.settings.judgeProviderId,
        });
        return;

      case 'debate-usage':
        await this.client.sendMessage(message.chat.id, formatter.formatDebateUsage());
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
        });
        return;

      case 'chat-usage':
        await this.client.sendMessage(message.chat.id, formatter.formatChatUsage());
        logTelegramProgress('INFO', 'command_response_sent', scope, {
          kind: parsed.kind,
        });
        return;

      case 'unknown':
        await this.client.sendMessage(message.chat.id, formatter.formatUnknownCommand(parsed.command));
        logTelegramProgress('WARN', 'unknown_command_response_sent', scope, {
          command: parsed.command,
        });
        return;

      case 'debate':
        await this.runDebate(update, message, parsed.question, formatter);
        return;

      case 'chat':
        await this.runGeneralChat(update, message, parsed.question, formatter);
        return;
    }
  }

  private async runDebate(
    update: TelegramUpdate,
    message: TelegramMessage,
    question: string,
    formatter: TelegramFormatter,
  ): Promise<void> {
    const scope = buildTelegramProgressScope(update);
    const template = this.getCurrentTemplate(message.chat.id);
    const participants = buildTemplateParticipants(template, this.settings.ollamaProviderIds);
    const startedAt = Date.now();
    logTelegramProgress('INFO', 'debate_started', scope, {
      templateId: template.id,
      questionPreview: question.slice(0, 200),
      participantProviders: participants.map((participant) => participant.provider),
    });
    const progressMessage = await this.client.sendMessage(
      message.chat.id,
      formatter.formatProgress('collecting_news'),
    );
    logTelegramProgress('DEBUG', 'progress_message_sent', scope, {
      phase: 'collecting_news',
      progressMessageId: progressMessage.message_id,
    });

    try {
      const newsQuery = buildStockNewsQuery(question);
      if (!newsQuery) {
        throw new Error('Question is empty.');
      }

      logTelegramProgress('INFO', 'evidence_collection_started', scope, {
        newsQuery,
      });
      const snapshot = await collectEvidence(newsQuery, {
        kind: 'news',
        quiet: true,
        maxArticles: this.settings.newsMaxArticles,
        queryTransform: {
          mode: this.settings.newsQueryTransformMode,
          languageScope: this.settings.newsQueryLanguageScope,
        },
      }, this.newsConfig);
      logTelegramProgress('INFO', 'evidence_collection_completed', scope, {
        snapshotId: snapshot.id,
        articleCount: snapshot.articles.length,
        sources: snapshot.sources,
      });

      await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatProgress('running_debate'),
      );
      logTelegramProgress('DEBUG', 'progress_message_updated', scope, {
        phase: 'running_debate',
        progressMessageId: progressMessage.message_id,
      });

      const providerMap = createProviderMap(participants, this.settings.judgeProviderId);
      const orchestrator = new DebateOrchestrator(providerMap);
      logTelegramProgress('INFO', 'debate_run_started', scope, {
        rounds: this.settings.rounds,
        judgeProviderId: this.settings.judgeProviderId,
      });
      const result = await orchestrator.run({
        question,
        rounds: this.settings.rounds,
        stream: false,
        synthesis: true,
        judge: this.settings.judgeProviderId,
        format: 'pretty',
        mode: 'debate',
        interactive: false,
        participants,
        noContext: true,
        snapshot,
        newsMode: this.settings.newsMode,
        workflowKind: 'news',
      }, createSilentCallbacks());

      if (!result.synthesis) {
        throw new Error('Debate completed without a final synthesis.');
      }
      logTelegramProgress('INFO', 'debate_run_completed', scope, {
        rounds: result.rounds,
        synthesisLength: result.synthesis.length,
        simplifiedLength: result.simplifiedSynthesis?.length ?? 0,
      });

      await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatProgress('summarizing'),
      );
      logTelegramProgress('DEBUG', 'progress_message_updated', scope, {
        phase: 'summarizing',
        progressMessageId: progressMessage.message_id,
      });

      const judgeProvider = providerMap.get(this.settings.judgeProviderId);
      if (!judgeProvider) {
        throw new Error(`Judge provider '${this.settings.judgeProviderId}' is unavailable.`);
      }

      logTelegramProgress('INFO', 'verdict_summary_started', scope, {
        judgeProviderId: this.settings.judgeProviderId,
      });
      const summary = await summarizeTelegramVerdict({
        provider: judgeProvider,
        question,
        templateLabel: template.label,
        language: resolveResponseLanguage(question, message.from?.language_code, this.settings.responseLanguage),
        synthesis: result.simplifiedSynthesis ?? result.synthesis,
        snapshot,
      });
      logTelegramProgress('INFO', 'verdict_summary_completed', scope, {
        verdict: summary.verdict,
        horizon: summary.horizon,
        confidence: summary.confidence,
      });

      const delivery = await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatVerdict({
          question,
          template,
          summary,
          snapshot,
        }),
      );
      logTelegramProgress('INFO', 'response_sent', scope, {
        mode: 'debate',
        delivery: delivery.delivery,
        responseMessageId: delivery.messageId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      logTelegramProgress('ERROR', 'debate_failed', scope, {
        error,
        durationMs: Date.now() - startedAt,
      });
      const delivery = await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatError(messageText),
      );
      logTelegramProgress('INFO', 'error_response_sent', scope, {
        mode: 'debate',
        delivery: delivery.delivery,
        responseMessageId: delivery.messageId,
      });
    }
  }

  private getCurrentTemplate(chatId: number) {
    const storedTemplateId = this.stateStore.getTemplateId(chatId);
    return resolveStockTemplate(storedTemplateId || this.settings.defaultTemplateId);
  }

  private async runGeneralChat(
    update: TelegramUpdate,
    message: TelegramMessage,
    question: string,
    formatter: TelegramFormatter,
  ): Promise<void> {
    const scope = buildTelegramProgressScope(update);
    if (!question) {
      await this.client.sendMessage(message.chat.id, formatter.formatChatUsage());
      logTelegramProgress('WARN', 'chat_usage_prompt_sent', scope, {});
      return;
    }

    const startedAt = Date.now();
    logTelegramProgress('INFO', 'general_chat_started', scope, {
      questionPreview: question.slice(0, 200),
      judgeProviderId: this.settings.judgeProviderId,
    });
    const progressMessage = await this.client.sendMessage(
      message.chat.id,
      formatter.formatProgress('answering'),
    );
    logTelegramProgress('DEBUG', 'progress_message_sent', scope, {
      phase: 'answering',
      progressMessageId: progressMessage.message_id,
    });

    try {
      const providerMap = createProviderMap([this.settings.judgeProviderId], this.settings.judgeProviderId);
      const judgeProvider = providerMap.get(this.settings.judgeProviderId);
      if (!judgeProvider) {
        throw new Error(`Judge provider '${this.settings.judgeProviderId}' is unavailable.`);
      }

      const answer = await generateGeneralChatReply(
        judgeProvider,
        question,
        resolveResponseLanguage(question, message.from?.language_code, this.settings.responseLanguage),
      );

      logTelegramProgress('INFO', 'general_chat_completed', scope, {
        answerLength: answer.length,
      });

      const delivery = await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatChatResponse(question, answer),
      );
      logTelegramProgress('INFO', 'response_sent', scope, {
        mode: 'chat',
        delivery: delivery.delivery,
        responseMessageId: delivery.messageId,
        durationMs: Date.now() - startedAt,
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Unknown error';
      logTelegramProgress('ERROR', 'general_chat_failed', scope, {
        error,
        durationMs: Date.now() - startedAt,
      });
      const delivery = await this.safeEditMessage(
        message.chat.id,
        progressMessage.message_id,
        formatter.formatError(messageText),
      );
      logTelegramProgress('INFO', 'error_response_sent', scope, {
        mode: 'chat',
        delivery: delivery.delivery,
        responseMessageId: delivery.messageId,
      });
    }
  }

  private getChatRejectionReason(message: TelegramMessage): string | null {
    if (message.chat.type !== 'private') {
      return 'unsupported_chat_type';
    }

    if (this.settings.allowedChatIds && !this.settings.allowedChatIds.has(message.chat.id)) {
      return 'chat_not_allowlisted';
    }

    return null;
  }

  private async safeEditMessage(
    chatId: number,
    messageId: number,
    text: string,
  ): Promise<{ delivery: 'edited' | 'sent'; messageId?: number }> {
    const edited = await this.client.editMessageText(chatId, messageId, text);
    if (edited) {
      return {
        delivery: 'edited',
        messageId: edited.message_id,
      };
    }

    const sent = await this.client.sendMessage(chatId, text);
    return {
      delivery: 'sent',
      messageId: sent.message_id,
    };
  }
}
