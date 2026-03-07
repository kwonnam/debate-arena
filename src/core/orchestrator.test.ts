import { describe, expect, it, vi } from 'vitest';
import { DebateOrchestrator } from './orchestrator.js';
import type { DebateCallbacks } from '../types/debate.js';
import type { Message } from '../providers/types.js';
import type { DebateEvent } from '../types/debate-events.js';

function createCallbacks(): DebateCallbacks {
  return {
    onRoundStart() {},
    onTurnStart() {},
    onToken() {},
    onTurnEnd() {},
    onSynthesisStart() {},
    onSynthesisToken() {},
    onSynthesisEnd() {},
    onRetry() {},
  };
}

async function* emptyStream(): AsyncIterable<string> {
  yield* [];
}

describe('DebateOrchestrator', () => {
  it('round 1 오프닝을 독립적으로 실행하고 round state를 synthesis에 전달한다', async () => {
    let sawCompressedRoundStates = false;

    const codex: any = {
      name: 'codex',
      generate: vi.fn(async (messages: Message[]) => {
        const prompt = messages.map((message) => message.content).join('\n\n');
        return prompt.includes('## Debate State So Far')
          ? 'Codex rebuttal'
          : 'Codex opening';
      }),
      stream: vi.fn(emptyStream),
    };

    const claude: any = {
      name: 'claude',
      generate: vi.fn(async (messages: Message[]) => {
        const prompt = messages.map((message) => message.content).join('\n\n');

        if (prompt.includes('You are extracting a compact reusable state')) {
          return [
            'SUMMARY: 양측은 단순성과 유연성의 균형을 두고 대립했다.',
            'ISSUES:',
            '- 운영 복잡도',
            '- 클라이언트 유연성',
            'AGREEMENTS:',
            '- 스키마 품질은 중요하다',
            'NEXT_FOCUS:',
            '- 운영 비용과 변경 빈도를 비교한다',
            'STOP_SUGGESTED: no',
            'STOP_REASON: none',
          ].join('\n');
        }

        if (prompt.includes('You are a fair and balanced judge reviewing a debate')) {
          sawCompressedRoundStates = prompt.includes('Compressed Round States:');
          return 'Balanced synthesis';
        }

        return prompt.includes('## Debate State So Far')
          ? 'Claude rebuttal'
          : 'Claude opening';
      }),
      stream: vi.fn(emptyStream),
    };

    const orchestrator = new DebateOrchestrator(new Map([
      ['codex', codex],
      ['claude', claude],
    ]));

    const result = await orchestrator.run({
      question: 'REST vs GraphQL?',
      rounds: 2,
      stream: false,
      synthesis: true,
      judge: 'claude',
      format: 'json',
    }, createCallbacks());

    expect(result.roundStates).toHaveLength(2);
    expect(result.synthesis).toBe('Balanced synthesis');
    expect(sawCompressedRoundStates).toBe(true);

    const claudeOpeningPrompt = claude.generate.mock.calls[0][0]
      .filter((message: Message) => message.role === 'user')
      .map((message: Message) => message.content)
      .join('\n');

    expect(claudeOpeningPrompt).not.toContain('Codex opening');

    const codexRebuttalPrompt = codex.generate.mock.calls[1][0]
      .filter((message: Message) => message.role === 'user')
      .map((message: Message) => message.content)
      .join('\n');

    expect(codexRebuttalPrompt).toContain('## Debate State So Far');
  });

  it('병렬 opening 스트림은 provider별 완성 본문으로만 flush한다', async () => {
    const events: DebateEvent[] = [];

    const codex: any = {
      name: 'codex',
      generate: vi.fn(async () => 'unused'),
      stream: vi.fn(async function* () {
        yield 'Codex ';
        yield 'opening';
      }),
    };

    const claude: any = {
      name: 'claude',
      generate: vi.fn(async (messages: Message[]) => {
        const prompt = messages.map((message) => message.content).join('\n\n');
        if (prompt.includes('You are extracting a compact reusable state')) {
          return [
            'SUMMARY: opening complete',
            'ISSUES:',
            '- issue',
            'AGREEMENTS:',
            '- none',
            'NEXT_FOCUS:',
            '- next',
            'STOP_SUGGESTED: no',
            'STOP_REASON: none',
          ].join('\n');
        }
        return 'unused';
      }),
      stream: vi.fn(async function* () {
        yield 'Claude ';
        yield 'opening';
      }),
    };

    const orchestrator = new DebateOrchestrator(
      new Map([
        ['codex', codex],
        ['claude', claude],
      ]),
      undefined,
      (event) => events.push(event),
    );

    await orchestrator.run({
      question: 'REST vs GraphQL?',
      rounds: 1,
      stream: true,
      synthesis: false,
      judge: 'claude',
      format: 'json',
    }, createCallbacks());

    const chunkEvents = events.filter((event) => event.type === 'agent_chunk');
    expect(chunkEvents).toHaveLength(2);
    expect(chunkEvents[0].payload.token).toBe('Codex opening');
    expect(chunkEvents[1].payload.token).toBe('Claude opening');
  });

  it('병렬 opening 중 한 provider가 실패하면 partial chunk를 남기지 않는다', async () => {
    const events: DebateEvent[] = [];

    const codex: any = {
      name: 'codex',
      generate: vi.fn(async () => 'unused'),
      stream: vi.fn(async function* () {
        yield 'Codex ';
        yield 'partial';
      }),
    };

    const claude: any = {
      name: 'claude',
      generate: vi.fn(async () => 'unused'),
      stream: vi.fn(async function* () {
        throw new Error('opening failed');
      }),
    };

    const orchestrator = new DebateOrchestrator(
      new Map([
        ['codex', codex],
        ['claude', claude],
      ]),
      undefined,
      (event) => events.push(event),
    );

    await expect(orchestrator.run({
      question: 'REST vs GraphQL?',
      rounds: 1,
      stream: true,
      synthesis: false,
      judge: 'claude',
      format: 'json',
    }, createCallbacks())).rejects.toThrow('opening failed');

    const chunkEvents = events.filter((event) => event.type === 'agent_chunk');
    expect(chunkEvents).toHaveLength(0);
  });

  it('interactive mode의 round_finished 이벤트는 user 턴을 포함한다', async () => {
    const events: DebateEvent[] = [];

    const codex = {
      name: 'codex',
      generate: vi.fn(async (messages: Message[]) => {
        const prompt = messages.map((message) => message.content).join('\n\n');
        return prompt.includes('## Debate State So Far') ? 'Codex rebuttal' : 'Codex opening';
      }),
      stream: vi.fn(emptyStream),
    };

    const claude = {
      name: 'claude',
      generate: vi.fn(async (messages: Message[]) => {
        const prompt = messages.map((message) => message.content).join('\n\n');
        if (prompt.includes('You are extracting a compact reusable state')) {
          return [
            'SUMMARY: user context included',
            'ISSUES:',
            '- issue',
            'AGREEMENTS:',
            '- none',
            'NEXT_FOCUS:',
            '- next',
            'STOP_SUGGESTED: no',
            'STOP_REASON: none',
          ].join('\n');
        }
        return prompt.includes('## Debate State So Far') ? 'Claude rebuttal' : 'Claude opening';
      }),
      stream: vi.fn(emptyStream),
    };

    const callbacks = createCallbacks();
    callbacks.onUserInput = async () => '사용자 추가 맥락';

    const orchestrator = new DebateOrchestrator(
      new Map([
        ['codex', codex],
        ['claude', claude],
      ]),
      undefined,
      (event) => events.push(event),
    );

    await orchestrator.run({
      question: 'REST vs GraphQL?',
      rounds: 1,
      stream: false,
      synthesis: false,
      judge: 'claude',
      format: 'json',
      interactive: true,
    }, callbacks);

    const roundFinished = events.find((event) => event.type === 'round_finished');
    expect(roundFinished).toBeDefined();
    expect(roundFinished?.payload.messages.some((message) => message.provider === 'user')).toBe(true);
  });
});
