import { defineMode } from './base.js';

export const DISCUSSION_MODE = defineMode({
  id: 'discussion',
  label: 'Discussion',
  sessionWord: 'discussion',
  goal: 'explore',
  goalLabel: 'Perspective exploration',
  protocolLabel: 'Collaborative discussion',
  processLabel: 'Discussion Process',
  conclusionLabel: 'Discussion Memo',
  roundStateLabel: 'Decision Board',
  decisionBoardLabel: 'Decision Board',
  openingLabel: 'Initial contribution',
  rebuttalLabel: 'Follow-up',
  filePrefix: 'discussion',
  artifact: {
    kind: 'memo',
    label: 'discussion memo',
    plainLanguageLabel: 'discussion memo conclusion',
    sections: [
      'Shared Understanding',
      'Key Trade-offs',
      'Recommendation',
      'Open Questions',
      'Next Steps',
    ],
  },
});
