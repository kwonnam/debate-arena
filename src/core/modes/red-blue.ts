import { defineMode } from './base.js';

export const RED_BLUE_MODE = defineMode({
  id: 'red-blue',
  label: 'Red/Blue',
  sessionWord: 'design review',
  goal: 'design',
  goalLabel: 'Design direction',
  protocolLabel: 'Challenge-and-defend review',
  processLabel: 'Red/Blue Review',
  conclusionLabel: 'Design Recommendation',
  roundStateLabel: 'Decision Board',
  decisionBoardLabel: 'Decision Board',
  openingLabel: 'Red challenge',
  rebuttalLabel: 'Blue defense',
  filePrefix: 'red-blue',
  artifact: {
    kind: 'adr',
    label: 'design recommendation',
    plainLanguageLabel: 'design recommendation memo',
    sections: [
      'Problem Context',
      'Alternatives Considered',
      'Selected Option',
      'Decision Rationale',
      'Implementation Strategy',
      'Open Risks',
    ],
  },
});
