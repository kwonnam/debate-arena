import { defineMode } from './base.js';

export const DEBATE_MODE = defineMode({
  id: 'debate',
  label: 'Debate',
  sessionWord: 'debate',
  goal: 'validate',
  goalLabel: 'Claim validation',
  protocolLabel: 'Structured debate',
  processLabel: 'Debate Process',
  conclusionLabel: 'Final Verdict',
  roundStateLabel: 'Decision Board',
  decisionBoardLabel: 'Decision Board',
  openingLabel: 'Opening',
  rebuttalLabel: 'Rebuttal',
  filePrefix: 'debate',
  artifact: {
    kind: 'verdict',
    label: 'final verdict',
    plainLanguageLabel: 'final debate conclusion',
    sections: [
      'Shared Ground',
      'Competing Arguments',
      'Verdict',
      'Caveats',
    ],
  },
});
