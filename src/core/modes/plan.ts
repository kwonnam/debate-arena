import { defineMode } from './base.js';

export const PLAN_MODE = defineMode({
  id: 'plan',
  label: 'Plan',
  sessionWord: 'plan',
  goal: 'implement',
  goalLabel: 'Implementation planning',
  protocolLabel: 'Implementation planning discussion',
  processLabel: 'Planning Process',
  conclusionLabel: 'Agreed Plan',
  roundStateLabel: 'Decision Board',
  decisionBoardLabel: 'Decision Board',
  openingLabel: 'Initial plan',
  rebuttalLabel: 'Review',
  filePrefix: 'plan',
  artifact: {
    kind: 'plan',
    label: 'implementation plan',
    plainLanguageLabel: 'agreed implementation plan',
    sections: [
      'Summary',
      'Files to Change',
      'Implementation Sequence',
      'Testing Strategy',
      'Risks & Mitigations',
    ],
  },
});
