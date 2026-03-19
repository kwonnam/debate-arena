import type { EvidenceSnapshot } from '../news/snapshot.js';
import type { DebateRoleTemplate } from '../types/roles.js';
import type { TelegramResponseLanguage } from './stock-utils.js';
import type { TelegramVerdictSummary } from './verdict.js';

const DISCLAIMER = {
  ko: '정보 제공 목적이며 투자 조언이 아닙니다.',
  en: 'For informational purposes only, not investment advice.',
} as const;

function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncateText(value: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function bulletLines(items: string[]): string {
  return items.map((item) => `• ${escapeHtml(item)}`).join('\n');
}

export class TelegramFormatter {
  private language: TelegramResponseLanguage;

  constructor(language: TelegramResponseLanguage = 'ko') {
    this.language = language;
  }

  setLanguage(language: TelegramResponseLanguage): void {
    this.language = language;
  }

  private isKo(): boolean {
    return this.language === 'ko';
  }

  private disclaimer(): string {
    return this.isKo() ? DISCLAIMER.ko : DISCLAIMER.en;
  }

  formatHelp(currentTemplate: DebateRoleTemplate): string {
    if (this.isKo()) {
      return this.finalize([
        '<b>Debate Arena Stock Bot</b>',
        '주가 질문은 뉴스 기반 내부 토론으로 처리하고, 일반 질문은 단일 LLM 답변으로 처리합니다.',
        '',
        '<b>예시</b>',
        '• <code>/debate TSLA 실적 발표 후 3개월 주가 전망은?</code>',
        '• <code>NVDA 지금 밸류에이션이 과열인가?</code>',
        '• <code>/chat Rust와 Go의 차이를 설명해줘</code>',
        '• <code>파이썬에서 데코레이터가 뭐야?</code>',
        '',
        '<b>명령어</b>',
        '• <code>/templates</code> 사용 가능한 주가 토론 템플릿 보기',
        `• <code>/template</code> 현재 템플릿 확인 (현재: <code>${escapeHtml(currentTemplate.id)}</code>)`,
        '• <code>/template news-stock-event-reaction</code> 템플릿 변경',
        '• <code>/chat 질문</code> 일반 질의응답',
        '• <code>/status</code> 현재 템플릿과 Ollama 모델 보기',
        '• <code>/help</code> 도움말',
      ].join('\n'));
    }

    return this.finalize([
      '<b>Debate Arena Stock Bot</b>',
      'Stock questions use an evidence-backed internal debate, while general questions are answered directly by a single LLM.',
      '',
      '<b>Examples</b>',
      '• <code>/debate What is the 3-month outlook after TSLA earnings?</code>',
      '• <code>Is NVDA valuation overheated right now?</code>',
      '• <code>/chat Explain the difference between Rust and Go</code>',
      '• <code>What is a Python decorator?</code>',
      '',
      '<b>Commands</b>',
      '• <code>/templates</code> Show stock debate templates',
      `• <code>/template</code> Show the current template (current: <code>${escapeHtml(currentTemplate.id)}</code>)`,
      '• <code>/template news-stock-event-reaction</code> Change the template',
      '• <code>/chat &lt;question&gt;</code> General Q&A',
      '• <code>/status</code> Show the current template and Ollama models',
      '• <code>/help</code> Show help',
    ].join('\n'));
  }

  formatTemplateList(currentTemplateId: string, templates: DebateRoleTemplate[]): string {
    const lines = templates.map((template) => {
      const marker = template.id === currentTemplateId ? (this.isKo() ? '현재값' : 'Current') : '';
      const suffix = marker ? ` <i>(${marker})</i>` : '';
      return `• <code>${escapeHtml(template.id)}</code>${suffix}\n  ${escapeHtml(template.label)}`;
    });

    if (this.isKo()) {
      return this.finalize([
        '<b>주가 토론 템플릿</b>',
        ...lines,
        '',
        '변경 예시: <code>/template news-stock-event-reaction</code>',
      ].join('\n'));
    }

    return this.finalize([
      '<b>Stock Debate Templates</b>',
      ...lines,
      '',
      'Change with: <code>/template news-stock-event-reaction</code>',
    ].join('\n'));
  }

  formatTemplateStatus(currentTemplate: DebateRoleTemplate): string {
    if (this.isKo()) {
      return this.finalize([
        '<b>현재 템플릿</b>',
        `<code>${escapeHtml(currentTemplate.id)}</code>`,
        escapeHtml(currentTemplate.label),
        '',
        `변경: <code>/template &lt;template-id&gt;</code>`,
      ].join('\n'));
    }

    return this.finalize([
      '<b>Current Template</b>',
      `<code>${escapeHtml(currentTemplate.id)}</code>`,
      escapeHtml(currentTemplate.label),
      '',
      'Change with: <code>/template &lt;template-id&gt;</code>',
    ].join('\n'));
  }

  formatTemplateChanged(template: DebateRoleTemplate): string {
    if (this.isKo()) {
      return this.finalize([
        '<b>템플릿 변경 완료</b>',
        `<code>${escapeHtml(template.id)}</code>`,
        escapeHtml(template.label),
      ].join('\n'));
    }

    return this.finalize([
      '<b>Template Updated</b>',
      `<code>${escapeHtml(template.id)}</code>`,
      escapeHtml(template.label),
    ].join('\n'));
  }

  formatUnknownTemplate(templateId: string, templates: DebateRoleTemplate[]): string {
    const available = templates.map((template) => `<code>${escapeHtml(template.id)}</code>`).join(', ');
    if (this.isKo()) {
      return this.finalize(`알 수 없는 템플릿입니다: <code>${escapeHtml(templateId)}</code>\n\n사용 가능: ${available}`);
    }
    return this.finalize(`Unknown template: <code>${escapeHtml(templateId)}</code>\n\nAvailable: ${available}`);
  }

  formatStatus(currentTemplate: DebateRoleTemplate, providerIds: string[], judgeProviderId: string, rounds: number): string {
    if (this.isKo()) {
      return this.finalize([
        '<b>현재 설정</b>',
        `<b>템플릿:</b> <code>${escapeHtml(currentTemplate.id)}</code>`,
        `<b>라운드:</b> ${rounds}`,
        `<b>Judge:</b> <code>${escapeHtml(judgeProviderId)}</code>`,
        `<b>Ollama 모델:</b> ${providerIds.map((providerId) => `<code>${escapeHtml(providerId)}</code>`).join(', ')}`,
      ].join('\n'));
    }

    return this.finalize([
      '<b>Current Settings</b>',
      `<b>Template:</b> <code>${escapeHtml(currentTemplate.id)}</code>`,
      `<b>Rounds:</b> ${rounds}`,
      `<b>Judge:</b> <code>${escapeHtml(judgeProviderId)}</code>`,
      `<b>Ollama Models:</b> ${providerIds.map((providerId) => `<code>${escapeHtml(providerId)}</code>`).join(', ')}`,
    ].join('\n'));
  }

  formatProgress(stage: 'collecting_news' | 'running_debate' | 'summarizing' | 'answering'): string {
    const label = this.isKo()
      ? {
          collecting_news: '질문에 맞는 뉴스 근거를 수집하는 중입니다...',
          running_debate: '뉴스를 바탕으로 내부 토론을 진행하는 중입니다...',
          summarizing: '최종 결론만 압축해서 정리하는 중입니다...',
          answering: '질문에 답하는 중입니다...',
        }[stage]
      : {
          collecting_news: 'Collecting matching news evidence...',
          running_debate: 'Running the internal stock debate...',
          summarizing: 'Compressing the final conclusion only...',
          answering: 'Answering your question...',
        }[stage];

    return this.finalize(label);
  }

  formatUnknownCommand(command: string): string {
    if (this.isKo()) {
      return this.finalize(`지원하지 않는 명령입니다: <code>${escapeHtml(command)}</code>\n\n<code>/help</code>로 사용법을 확인하세요.`);
    }
    return this.finalize(`Unsupported command: <code>${escapeHtml(command)}</code>\n\nUse <code>/help</code> for available commands.`);
  }

  formatDebateUsage(): string {
    if (this.isKo()) {
      return this.finalize('<code>/debate NVDA 지금 매수해도 될까?</code>처럼 질문을 함께 보내 주세요.');
    }
    return this.finalize('Send a question together with the command, for example <code>/debate Should I buy NVDA now?</code>.');
  }

  formatChatUsage(): string {
    if (this.isKo()) {
      return this.finalize('<code>/chat Rust와 Go의 차이를 설명해줘</code>처럼 질문을 함께 보내 주세요.');
    }
    return this.finalize('Send a question together with the command, for example <code>/chat Explain the difference between Rust and Go</code>.');
  }

  formatError(error: string): string {
    if (this.isKo()) {
      return this.finalize(`요청을 완료하지 못했습니다.\n\n${escapeHtml(error)}`);
    }
    return this.finalize(`The request could not be completed.\n\n${escapeHtml(error)}`);
  }

  formatVerdict(input: {
    question: string;
    template: DebateRoleTemplate;
    summary: TelegramVerdictSummary;
    snapshot?: EvidenceSnapshot;
  }): string {
    const newsItems = input.summary.news.length > 0
      ? input.summary.news
      : (input.snapshot?.articles ?? []).slice(0, 3).map((article) => ({
          source: article.source,
          date: article.publishedAt.slice(0, 10),
          headline: article.title,
        }));

    const sections: string[] = [
      `<b>${escapeHtml(truncateText(input.question, 180))}</b>`,
      '',
      `<b>${this.isKo() ? '결론' : 'Conclusion'}</b>`,
      escapeHtml(truncateText(input.summary.answer, 900)),
    ];

    const meta: string[] = [];
    if (input.summary.verdict) {
      meta.push(`${this.isKo() ? '판단' : 'Verdict'}: ${escapeHtml(input.summary.verdict)}`);
    }
    if (input.summary.horizon) {
      meta.push(`${this.isKo() ? '기간' : 'Horizon'}: ${escapeHtml(input.summary.horizon)}`);
    }
    if (input.summary.confidence) {
      meta.push(`${this.isKo() ? '확신도' : 'Confidence'}: ${escapeHtml(input.summary.confidence)}`);
    }
    if (meta.length > 0) {
      sections.push('', meta.map((line) => `<b>${line}</b>`).join('\n'));
    }

    if (input.summary.thesis.length > 0) {
      sections.push('', `<b>${this.isKo() ? '핵심 근거' : 'Why'}</b>`, bulletLines(input.summary.thesis));
    }

    if (input.summary.risks.length > 0) {
      sections.push('', `<b>${this.isKo() ? '리스크' : 'Risks'}</b>`, bulletLines(input.summary.risks));
    }

    if (newsItems.length > 0) {
      sections.push(
        '',
        `<b>${this.isKo() ? '근거 뉴스' : 'Evidence News'}</b>`,
        bulletLines(newsItems.map((item) => `${item.source} ${item.date} - ${item.headline}`)),
      );
    }

    sections.push(
      '',
      `<i>${this.isKo() ? '템플릿' : 'Template'}: ${escapeHtml(input.template.label)} · ${this.disclaimer()}</i>`,
    );

    return this.finalize(sections.join('\n'));
  }

  formatChatResponse(question: string, answer: string): string {
    const sections = [
      `<b>${escapeHtml(truncateText(question, 180))}</b>`,
      '',
      escapeHtml(truncateText(answer, 3200)),
    ];

    return this.finalize(sections.join('\n'));
  }

  private finalize(text: string): string {
    return truncateText(text, 3900);
  }
}
