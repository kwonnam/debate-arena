import type { DebateMode } from '../../types/debate.js';
import type { DebateModeDefinition } from './base.js';
import { DEBATE_MODE } from './debate.js';
import { DISCUSSION_MODE } from './discussion.js';
import { PLAN_MODE } from './plan.js';
import { RED_BLUE_MODE } from './red-blue.js';

const MODE_DEFINITIONS = {
  debate: DEBATE_MODE,
  discussion: DISCUSSION_MODE,
  'red-blue': RED_BLUE_MODE,
  plan: PLAN_MODE,
} satisfies Record<DebateMode, DebateModeDefinition>;

export function getDebateModeDefinition(mode: DebateMode) {
  return MODE_DEFINITIONS[mode] ?? DEBATE_MODE;
}

export function listDebateModeDefinitions() {
  return Object.values(MODE_DEFINITIONS);
}
