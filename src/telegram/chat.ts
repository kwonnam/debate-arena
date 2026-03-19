import type { AIProvider, Message } from '../providers/types.js';
import type { TelegramResponseLanguage } from './stock-utils.js';

export async function generateGeneralChatReply(
  provider: AIProvider,
  question: string,
  language: TelegramResponseLanguage,
): Promise<string> {
  const responseLanguage = language === 'ko' ? 'Korean' : 'English';
  const messages: Message[] = [
    {
      role: 'system',
      content: [
        'You are the Debate Arena Telegram assistant.',
        'Answer the user directly without mentioning hidden debates, internal tools, or chain-of-thought.',
        'Be concise, helpful, and accurate.',
        `Respond in ${responseLanguage}.`,
      ].join('\n'),
    },
    {
      role: 'user',
      content: question,
    },
  ];

  return provider.generate(messages);
}
