const sessionList = document.getElementById('session-list');
const streamBox = document.getElementById('stream');
const timelineBox = document.getElementById('timeline');
const synthesisBox = document.getElementById('synthesis');
const synthesisSection = document.getElementById('synthesis-section');
const pageWorkflow = document.body.dataset.workflow || 'all';
const refreshButton = document.getElementById('refresh');
const replayButton = document.getElementById('replay');
const replayInput = document.getElementById('replay-seq');
const executeStatus = document.getElementById('execute-status');
const stopSessionButton = document.getElementById('stop-session');
const stopTeamButton = document.getElementById('stop-team');
const exportMarkdownButton = document.getElementById('export-md');
const connBadge = document.getElementById('conn-badge');
const roundProgress = document.getElementById('round-progress');
const roundLabel = document.getElementById('round-label');
const roundFill = document.getElementById('round-fill');
const gapBanner = document.getElementById('gap-banner');
const typingIndicator = document.getElementById('typing-indicator');
const participantLanes = document.getElementById('participant-lanes');

const projectForm = document.getElementById('project-form');
const projectQuestionInput = projectForm?.querySelector('[name="question"]');
const projectExecutionCwdInput = document.getElementById('project-execution-cwd');
const projectRuntimeHint = document.getElementById('project-runtime-hint');
const projectAdvancedToggle = document.getElementById('project-advanced-toggle');
const projectAdvancedFields = document.getElementById('project-advanced-fields');
const projectParticipantMode = document.getElementById('project-participant-mode');
const projectTemplatePanel = document.getElementById('project-template-panel');
const projectCustomPanel = document.getElementById('project-custom-panel');
const projectCustomCount = document.getElementById('project-custom-count');
const projectTemplateSelect = document.getElementById('project-template-select');
const projectTemplateSummary = document.getElementById('project-template-description');
const projectRoleSlots = document.getElementById('project-participant-config');
const projectCustomRoleSlots = document.getElementById('project-custom-participant-config');
const projectCustomSummary = document.getElementById('project-custom-summary');
const projectJudgeSelect = projectForm?.querySelector('select[name="judge"]');

const newsForm = document.getElementById('news-form');
const newsQuestionInput = newsForm?.querySelector('[name="question"]');
const newsQueryInput = document.getElementById('news-query');
const useNewsQuestionButton = document.getElementById('use-news-question');
const newsCollectButton = document.getElementById('news-collect-btn');
const newsCollectStatus = document.getElementById('news-collect-status');
const newsAdvancedToggle = document.getElementById('news-advanced-toggle');
const newsAdvancedFields = document.getElementById('news-advanced-fields');
const newsExecutionCwdInput = document.getElementById('news-execution-cwd');
const newsOllamaModelGroup = document.getElementById('news-ollama-model-group');
const newsOllamaModelSelect = document.getElementById('news-ollama-model');
const debateSnapshotInput = document.getElementById('debate-snapshot-id');
const newsParticipantMode = document.getElementById('news-participant-mode');
const newsTemplatePanel = document.getElementById('news-template-panel');
const newsCustomPanel = document.getElementById('news-custom-panel');
const newsCustomCount = document.getElementById('news-custom-count');
const newsTemplateSelect = document.getElementById('news-template-select');
const newsTemplateSummary = document.getElementById('news-template-description');
const newsRoleSlots = document.getElementById('news-participant-config');
const newsCustomRoleSlots = document.getElementById('news-custom-participant-config');
const newsCustomSummary = document.getElementById('news-custom-summary');
const newsJudgeSelect = newsForm?.querySelector('select[name="judge"]');

const roleConfigPath = document.getElementById('role-config-path');
const roleConfigStatus = document.getElementById('role-config-status');
const roleConfigEditor = document.getElementById('role-config-editor');
const roleConfigPreview = {
  news: document.getElementById('news-template-preview'),
  project: document.getElementById('project-template-preview'),
};
const roleConfigReloadButton = document.getElementById('role-config-reload');
const roleConfigSaveButton = document.getElementById('role-config-save');
const roleConfigResetButton = document.getElementById('role-config-reset');
const roleConfigValidation = document.getElementById('role-config-validation');
const roleConfigMeta = document.getElementById('role-config-meta');
const roleConfigRevision = document.getElementById('role-config-revision');

const snapshotList = document.getElementById('snapshot-list');
const selectedEvidence = document.getElementById('selected-evidence');
const sessionBrief = document.getElementById('session-brief');
const decisionBoard = document.getElementById('decision-board');
const roundHistory = document.getElementById('round-history');
const evidencePack = document.getElementById('evidence-pack');
const openEvidenceModalButton = document.getElementById('open-evidence-modal');

const articleModal = document.getElementById('article-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');

let activeSessionId = null;
let activeSessionSummary = null;
let eventSource = null;
let lastSequence = 0;
let renderedSequences = new Set();
let bubbleMessages = [];
let timelineEntries = [];
let synthesisContent = '';
let latestRoundState = null;
let roundStateHistory = [];
let selectedRoundNumber = null;

let cachedSessions = [];
let cachedSnapshots = [];
let cachedOllamaModels = [];
let cachedProviderOptions = [];
let cachedJudgeOptions = [];
let roleTemplateConfig = null;
let roleTemplateDefaults = { project: '', news: '' };
let roleConfigDefaultRaw = '';
let workflowRoleAssignments = {
  project: {},
  news: {},
};
let workflowParticipantComposer = {
  project: { mode: 'template', customParticipants: [] },
  news: { mode: 'template', customParticipants: [] },
};
let currentParticipants = [
  createFallbackParticipant('codex', 'codex-default', 'Codex'),
  createFallbackParticipant('claude', 'claude-default', 'Claude'),
];
let totalRounds = 3;
let defaultRuntimeCwd = '';

let selectedSnapshotId = null;
const snapshotDetailCache = new Map();

let connState = 'idle';
let stalledTimer = null;

const MAX_FILES = 6;
const MAX_TEXT_FILE_CHARS = 12_000;
const MAX_IMAGE_DATA_URL_CHARS = 180_000;
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 6;
const CUSTOM_ROLE_VALUE = '__custom__';
const PARTICIPANT_SIDE_SEQUENCE = ['a', 'b', 'c'];

function createFallbackParticipant(provider, id, label) {
  return {
    id,
    provider,
    label,
    role: {
      roleId: id,
      roleLabel: label,
      focus: '',
      instructions: [],
      requiredQuestions: [],
    },
  };
}

function getWorkflowControls(workflow) {
  if (workflow === 'news') {
    return {
      form: newsForm,
      participantMode: newsParticipantMode,
      templatePanel: newsTemplatePanel,
      customPanel: newsCustomPanel,
      customCountSelect: newsCustomCount,
      templateSelect: newsTemplateSelect,
      templateSummary: newsTemplateSummary,
      roleSlots: newsRoleSlots,
      customRoleSlots: newsCustomRoleSlots,
      customSummary: newsCustomSummary,
      judgeSelect: newsJudgeSelect,
    };
  }

  return {
    form: projectForm,
    participantMode: projectParticipantMode,
    templatePanel: projectTemplatePanel,
    customPanel: projectCustomPanel,
    customCountSelect: projectCustomCount,
    templateSelect: projectTemplateSelect,
    templateSummary: projectTemplateSummary,
    roleSlots: projectRoleSlots,
    customRoleSlots: projectCustomRoleSlots,
    customSummary: projectCustomSummary,
    judgeSelect: projectJudgeSelect,
  };
}

function getDefaultTemplateId(workflow) {
  return roleTemplateDefaults[workflow] || getWorkflowTemplates(workflow)[0]?.id || '';
}

function getSelectedTemplate(workflow) {
  const controls = getWorkflowControls(workflow);
  const selectedId = controls.templateSelect?.value || getDefaultTemplateId(workflow);
  return getWorkflowTemplates(workflow).find((template) => template.id === selectedId) || getWorkflowTemplates(workflow)[0] || null;
}

function slugifyValue(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function clampParticipantCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return MIN_PARTICIPANTS;
  }
  return Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, Math.trunc(numeric)));
}

function getWorkflowComposerState(workflow) {
  return workflowParticipantComposer[workflow] || { mode: 'template', customParticipants: [] };
}

function getWorkflowMode(workflow) {
  return getWorkflowComposerState(workflow).mode === 'custom' ? 'custom' : 'template';
}

function setWorkflowMode(workflow, mode) {
  if (!workflowParticipantComposer[workflow]) {
    workflowParticipantComposer[workflow] = { mode: 'template', customParticipants: [] };
  }
  workflowParticipantComposer[workflow].mode = mode === 'custom' ? 'custom' : 'template';
}

function setConnState(state) {
  connState = state;
  if (!connBadge) return;
  connBadge.className = `conn-badge state-${state}`;

  const labels = {
    idle: '⚪ 대기',
    connecting: '🔵 연결 중',
    live: '🟢 실시간 연결',
    reconnecting: '🟡 재연결 중',
    stalled: '🔴 정지 감지',
  };

  connBadge.textContent = labels[state] || state;

  if (state === 'live') {
    clearTimeout(stalledTimer);
    stalledTimer = null;
  }
}

function startStalledTimer() {
  clearTimeout(stalledTimer);
  stalledTimer = setTimeout(() => {
    if (connState === 'live' || connState === 'reconnecting') {
      setConnState('stalled');
    }
  }, 30000);
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderInlineMarkdown(text) {
  let rendered = escapeHtml(text);
  rendered = rendered.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );
  rendered = rendered.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  rendered = rendered.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  rendered = rendered.replace(/`([^`]+)`/g, '<code>$1</code>');
  return rendered;
}

function markdownToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const html = [];
  let inCode = false;
  let codeLines = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLines = [];
      } else {
        closeLists();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      closeLists();
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      closeLists();
      html.push('<hr />');
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = line.match(/^\s*[-*]\s+(.+)$/);
    if (unordered) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${renderInlineMarkdown(unordered[1])}</li>`);
      continue;
    }

    const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ordered) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${renderInlineMarkdown(ordered[1])}</li>`);
      continue;
    }

    const quote = line.match(/^\s*>\s?(.+)$/);
    if (quote) {
      closeLists();
      html.push(`<blockquote>${renderInlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    closeLists();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  }

  closeLists();
  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }

  return html.join('\n');
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString();
}

function formatDate(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleDateString();
}

function formatDateTime(ts) {
  if (!ts) return '';
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleString();
}

function pageAllowsWorkflow(workflowKind) {
  if (pageWorkflow === 'news') {
    return workflowKind === 'news';
  }

  if (pageWorkflow === 'project') {
    return workflowKind !== 'news';
  }

  return true;
}

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function shortPath(value) {
  if (!value) return '';
  if (value.length <= 48) return value;
  return `...${value.slice(-45)}`;
}

function getWorkflowMeta(workflowKind) {
  if (workflowKind === 'news') {
    return { label: '뉴스 토론', className: 'workflow-news' };
  }

  if (workflowKind === 'project') {
    return { label: '프로젝트 개선', className: 'workflow-project' };
  }

  return { label: '일반 토론', className: 'workflow-general' };
}

function statusToClass(status) {
  return String(status || '').toUpperCase();
}

function normalizeParticipants(participants) {
  if (!Array.isArray(participants)) {
    return [];
  }

  return participants
    .map((participant, index) => {
      if (typeof participant === 'string') {
        const label = participant.trim();
        return {
          id: `${label || 'participant'}-${index + 1}`,
          label,
          provider: label,
        };
      }

      if (!participant || typeof participant !== 'object') {
        return null;
      }

      const label = String(participant.label || participant.roleLabel || participant.provider || `Participant ${index + 1}`).trim();
      const provider = String(participant.provider || '').trim();
      const id = String(participant.id || `${provider || 'participant'}-${index + 1}`).trim();

      return {
        id,
        label,
        provider,
        role: participant.role || {
          roleId: String(participant.roleId || id),
          roleLabel: String(participant.roleLabel || label),
          focus: String(participant.focus || ''),
          instructions: [],
          requiredQuestions: [],
        },
      };
    })
    .filter(Boolean);
}

function formatParticipantLabel(participant) {
  if (!participant) return '';
  if (!participant.provider) return participant.label;
  return `${participant.label} (${participant.provider})`;
}

function formatParticipantsInline(participants) {
  const normalized = normalizeParticipants(participants);
  if (normalized.length === 0) {
    return '';
  }

  return normalized.map(formatParticipantLabel).join(' · ');
}

function getParticipantSide(participantId, provider = '') {
  const targetId = String(participantId || '').toLowerCase();
  const index = currentParticipants.findIndex((participant) => {
    return participant.id.toLowerCase() === targetId
      || participant.provider.toLowerCase() === String(provider || '').toLowerCase();
  });

  if (index < 0) return PARTICIPANT_SIDE_SEQUENCE[0];
  return PARTICIPANT_SIDE_SEQUENCE[index % PARTICIPANT_SIDE_SEQUENCE.length];
}

function renderParticipantLanes() {
  if (!participantLanes) return;

  participantLanes.dataset.count = String(currentParticipants.length || 0);
  participantLanes.className = 'participant-lanes participant-lanes-dynamic';
  participantLanes.innerHTML = currentParticipants
    .map((participant, index) => {
      const laneClass = getParticipantSide(participant.id, participant.provider);
      const slotLabel = `Participant ${index + 1}`;
      const roleLabel = participant.role?.roleLabel || participant.label;
      return `
        <div class="lane-card ${laneClass}">
          <div class="lane-card-header">
            <span>${escapeHtml(slotLabel)}</span>
            <span class="lane-card-provider">${escapeHtml(participant.provider)}</span>
          </div>
          <strong>${escapeHtml(participant.label)}</strong>
          <small class="lane-card-role">${escapeHtml(roleLabel)}</small>
        </div>
      `;
    })
    .join('');
}

function appendBubble(participantId, label, provider, text) {
  if (!typingIndicator || !streamBox) return;

  const normalizedParticipantId = String(participantId || provider || 'unknown');
  const normalizedLabel = String(label || provider || 'unknown');
  const normalizedProvider = String(provider || 'unknown');
  const token = String(text || '');
  const last = bubbleMessages.at(-1);

  if (last && last.participantId === normalizedParticipantId) {
    last.content += token;
  } else {
    bubbleMessages.push({
      participantId: normalizedParticipantId,
      label: normalizedLabel,
      provider: normalizedProvider,
      content: token,
      side: getParticipantSide(normalizedParticipantId, normalizedProvider),
    });
  }

  typingIndicator.style.display = 'flex';
  renderBubbles();
  streamBox.scrollTop = streamBox.scrollHeight;
}

function stopTyping() {
  if (!typingIndicator) return;
  typingIndicator.style.display = 'none';
}

function renderBubbles() {
  if (!streamBox) return;

  if (bubbleMessages.length === 0) {
    streamBox.innerHTML = '<div class="stream-empty">토론이 시작되면 여기에서 실시간으로 관찰할 수 있습니다.</div>';
    return;
  }

  streamBox.innerHTML = bubbleMessages
    .map((message) => {
      const sameProvider = currentParticipants.filter((participant) => participant.provider === message.provider).length > 1;
      const judgeClass = message.participantId === 'judge' ? 'is-judge' : '';
      const bubbleClass = sameProvider ? 'bubble same-provider' : 'bubble';
      return `
      <div class="bubble-wrapper side-${message.side} ${judgeClass}">
        <div class="bubble-provider">${escapeHtml(message.label)} <span>${escapeHtml(message.provider)}</span></div>
        <div class="${bubbleClass}">
          <div class="markdown-body">${markdownToHtml(message.content)}</div>
        </div>
      </div>
    `;
    })
    .join('');
}

function renderTimeline() {
  if (!timelineBox) return;

  if (timelineEntries.length === 0) {
    timelineBox.innerHTML = '<div class="timeline-entry">이벤트가 아직 없습니다.</div>';
    return;
  }

  timelineBox.innerHTML = timelineEntries
    .map((entry) => `<div class="timeline-entry ${entry.type || ''}">${escapeHtml(entry.text)}</div>`)
    .join('');
}

function addTimelineEntry(text, type = '') {
  timelineEntries.push({ text, type });
  renderTimeline();
}

function updateRoundProgress(round, total) {
  if (!roundProgress || !roundLabel || !roundFill) return;

  roundProgress.style.display = 'flex';
  roundLabel.textContent = `Round ${round} / ${total}`;
  roundFill.style.width = `${Math.min(100, (round / Math.max(total, 1)) * 100)}%`;
}

function renderSynthesis() {
  if (!synthesisSection || !synthesisBox) return;

  if (!synthesisContent) {
    synthesisSection.style.display = 'none';
    return;
  }

  synthesisSection.style.display = 'block';

  if (synthesisContent === 'Synthesizing...') {
    synthesisBox.innerHTML = '<div class="markdown-body"><p><em>최종 결론을 정리하는 중입니다...</em></p></div>';
    return;
  }

  synthesisBox.innerHTML = `<div class="markdown-body">${markdownToHtml(synthesisContent)}</div>`;
}

function renderListMarkup(items, emptyText) {
  if (!Array.isArray(items) || items.length === 0) {
    return `<p class="session-meta">${escapeHtml(emptyText)}</p>`;
  }

  return `<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`;
}

function upsertRoundState(roundState) {
  if (!roundState || typeof roundState.round !== 'number') {
    return;
  }

  const shouldFollowLatest = selectedRoundNumber === null || selectedRoundNumber === latestRoundState?.round;
  const existingIndex = roundStateHistory.findIndex((item) => item.round === roundState.round);
  if (existingIndex >= 0) {
    roundStateHistory[existingIndex] = roundState;
  } else {
    roundStateHistory.push(roundState);
    roundStateHistory.sort((left, right) => left.round - right.round);
  }

  latestRoundState = roundStateHistory.at(-1) || null;
  if (shouldFollowLatest) {
    selectedRoundNumber = roundState.round;
  }
}

function getDisplayedRoundState() {
  if (selectedRoundNumber === null) {
    return latestRoundState;
  }

  return roundStateHistory.find((item) => item.round === selectedRoundNumber) || latestRoundState;
}

function renderRoundHistory() {
  if (!roundHistory) return;

  if (roundStateHistory.length === 0) {
    roundHistory.innerHTML = '';
    roundHistory.style.display = 'none';
    return;
  }

  roundHistory.style.display = 'flex';
  const displayedRound = getDisplayedRoundState()?.round;
  const latestRound = latestRoundState?.round;

  roundHistory.innerHTML = roundStateHistory
    .map((roundState) => {
      const isActive = roundState.round === displayedRound ? 'is-active' : '';
      const isLatest = roundState.round === latestRound ? '<span class="round-pill">Latest</span>' : '';

      return `
        <button
          class="round-tab ${isActive}"
          type="button"
          data-round="${escapeHtml(roundState.round)}"
          role="tab"
          tabindex="${roundState.round === displayedRound ? '0' : '-1'}"
          aria-selected="${String(roundState.round === displayedRound)}"
          aria-label="Round ${escapeHtml(roundState.round)}${roundState.round === latestRound ? ', latest' : ''}"
        >
          <span>Round ${escapeHtml(roundState.round)}</span>
          ${isLatest}
        </button>
      `;
    })
    .join('');

  roundHistory.querySelectorAll('[data-round]').forEach((button) => {
    button.addEventListener('click', () => {
      const round = Number(button.getAttribute('data-round'));
      if (!Number.isFinite(round)) return;
      selectedRoundNumber = round;
      renderDecisionBoard();
    });

    button.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
        return;
      }

      event.preventDefault();
      const roundButtons = Array.from(roundHistory.querySelectorAll('[data-round]'));
      const currentIndex = roundButtons.indexOf(button);
      if (currentIndex < 0) return;

      const nextIndex = event.key === 'ArrowRight'
        ? Math.min(roundButtons.length - 1, currentIndex + 1)
        : Math.max(0, currentIndex - 1);

      const targetButton = roundButtons[nextIndex];
      targetButton?.focus();
      targetButton?.click();
    });
  });
}

function renderDecisionBoard() {
  if (!decisionBoard) return;

  const displayedRoundState = getDisplayedRoundState();

  if (!displayedRoundState) {
    decisionBoard.className = 'decision-board empty';
    decisionBoard.innerHTML = '라운드가 끝나면 핵심 보드가 이곳에 표시됩니다.';
    renderRoundHistory();
    return;
  }

  const warning = displayedRoundState.warning
    ? `<div class="decision-board-card"><h4>주의</h4><p class="session-meta">${escapeHtml(displayedRoundState.warning)}</p></div>`
    : '';
  const latestCopy = displayedRoundState.round === latestRoundState?.round ? '최신 라운드' : `Round ${latestRoundState?.round || displayedRoundState.round} 기준 최신`;

  decisionBoard.className = 'decision-board';
  decisionBoard.innerHTML = `
    <div class="decision-board-summary">
      <div class="decision-board-kicker">
        <span class="round-pill">${escapeHtml(latestCopy)}</span>
      </div>
      <h3>Round ${escapeHtml(displayedRoundState.round)}</h3>
      <div class="markdown-body">${markdownToHtml(displayedRoundState.summary || '요약 없음')}</div>
    </div>
    <div class="decision-board-grid">
      <div class="decision-board-card">
        <h4>핵심 쟁점</h4>
        ${renderListMarkup(displayedRoundState.keyIssues, '핵심 쟁점이 없습니다.')}
      </div>
      <div class="decision-board-card">
        <h4>합의된 부분</h4>
        ${renderListMarkup(displayedRoundState.agreements, '아직 합의가 없습니다.')}
      </div>
      <div class="decision-board-card">
        <h4>다음 포커스</h4>
        ${renderListMarkup(displayedRoundState.nextFocus, '다음 포커스가 없습니다.')}
      </div>
    </div>
    ${warning}
  `;
  renderRoundHistory();
}

function getWorkflowProviderOptions(workflow) {
  if (workflow === 'project') {
    return cachedProviderOptions.filter((option) => option.value !== 'ollama');
  }

  return cachedProviderOptions;
}

function getWorkflowJudgeOptions(workflow) {
  if (workflow === 'project') {
    return cachedJudgeOptions.filter((option) => option.value !== 'ollama');
  }

  return cachedJudgeOptions;
}

function getWorkflowTemplates(workflow) {
  const templates = roleTemplateConfig?.workflows?.[workflow]?.templates;
  return Array.isArray(templates) ? templates : [];
}

function getWorkflowRoleCatalog(workflow) {
  const catalog = [];
  const seen = new Set();

  for (const template of getWorkflowTemplates(workflow)) {
    for (const role of template.participants || []) {
      const roleId = String(role.roleId || '').trim();
      if (!roleId || seen.has(roleId)) {
        continue;
      }

      seen.add(roleId);
      catalog.push({
        roleId,
        label: String(role.label || role.roleLabel || roleId).trim() || roleId,
        focus: String(role.focus || '').trim(),
        instructions: Array.isArray(role.instructions) ? role.instructions.map((item) => String(item).trim()).filter(Boolean) : [],
        requiredQuestions: Array.isArray(role.requiredQuestions)
          ? role.requiredQuestions.map((item) => String(item).trim()).filter(Boolean)
          : [],
        defaultProvider: String(role.defaultProvider || '').trim(),
      });
    }
  }

  catalog.push({
    roleId: CUSTOM_ROLE_VALUE,
    label: '직접 입력',
    focus: '',
    instructions: [],
    requiredQuestions: [],
    defaultProvider: '',
  });

  return catalog;
}

function getWorkflowRoleDefinition(workflow, roleId) {
  return getWorkflowRoleCatalog(workflow).find((role) => role.roleId === roleId) || null;
}

function getPreferredWorkflowProvider(workflow, ...preferredValues) {
  const providerOptions = getWorkflowProviderOptions(workflow);
  for (const preferredValue of preferredValues) {
    if (providerOptions.some((option) => option.value === preferredValue && !option.disabled)) {
      return preferredValue;
    }
  }

  return providerOptions.find((option) => !option.disabled)?.value || '';
}

function createCustomParticipantDraft(workflow, index, overrides = {}) {
  const catalog = getWorkflowRoleCatalog(workflow);
  const templateRole = getSelectedTemplate(workflow)?.participants?.[index];
  const preferredRoleId = String(overrides.roleId || templateRole?.roleId || '').trim();
  const hasPreferredRole = catalog.some((role) => role.roleId === preferredRoleId);
  const defaultRole = catalog.find((role) => role.roleId !== CUSTOM_ROLE_VALUE) || catalog[0] || null;
  const roleId = overrides.customLabel
    ? CUSTOM_ROLE_VALUE
    : hasPreferredRole
      ? preferredRoleId
      : defaultRole?.roleId || CUSTOM_ROLE_VALUE;
  const roleDefinition = getWorkflowRoleDefinition(workflow, roleId);

  return {
    roleId,
    customLabel: String(overrides.customLabel || '').trim(),
    provider: getPreferredWorkflowProvider(
      workflow,
      overrides.provider,
      workflowRoleAssignments[workflow]?.[templateRole?.roleId],
      roleDefinition?.defaultProvider,
      templateRole?.defaultProvider,
    ),
  };
}

function seedCustomParticipantsFromTemplate(workflow) {
  const template = getSelectedTemplate(workflow);
  const templateRoles = template?.participants || [];
  const desiredCount = clampParticipantCount(templateRoles.length || MIN_PARTICIPANTS);
  const customParticipants = [];

  for (let index = 0; index < desiredCount; index += 1) {
    const templateRole = templateRoles[index];
    customParticipants.push(createCustomParticipantDraft(workflow, index, {
      roleId: templateRole?.roleId,
      provider: workflowRoleAssignments[workflow]?.[templateRole?.roleId] || templateRole?.defaultProvider || '',
    }));
  }

  workflowParticipantComposer[workflow] = {
    ...getWorkflowComposerState(workflow),
    customParticipants,
  };
}

function ensureWorkflowCustomParticipants(workflow) {
  const state = getWorkflowComposerState(workflow);
  if (!Array.isArray(state.customParticipants) || state.customParticipants.length === 0) {
    seedCustomParticipantsFromTemplate(workflow);
  }

  const nextParticipants = [];
  const targetCount = clampParticipantCount(getWorkflowComposerState(workflow).customParticipants.length || MIN_PARTICIPANTS);
  const current = getWorkflowComposerState(workflow).customParticipants || [];

  for (let index = 0; index < targetCount; index += 1) {
    nextParticipants.push(createCustomParticipantDraft(workflow, index, current[index]));
  }

  workflowParticipantComposer[workflow] = {
    ...getWorkflowComposerState(workflow),
    customParticipants: nextParticipants,
  };
}

function setWorkflowCustomParticipantCount(workflow, value) {
  ensureWorkflowCustomParticipants(workflow);
  const targetCount = clampParticipantCount(value);
  const current = getWorkflowComposerState(workflow).customParticipants || [];
  const nextParticipants = [];

  for (let index = 0; index < targetCount; index += 1) {
    nextParticipants.push(createCustomParticipantDraft(workflow, index, current[index]));
  }

  workflowParticipantComposer[workflow] = {
    ...getWorkflowComposerState(workflow),
    customParticipants: nextParticipants,
  };
}

function getWorkflowParticipantDraftRoleLabel(workflow, draft, index) {
  if (!draft) {
    return '';
  }

  if (draft.roleId === CUSTOM_ROLE_VALUE) {
    return String(draft.customLabel || '').trim();
  }

  return getWorkflowRoleDefinition(workflow, draft.roleId)?.label || `Participant ${index + 1}`;
}

function buildWorkflowCustomParticipantPreview(workflow, draft, index) {
  const provider = String(draft?.provider || '').trim();
  const roleLabel = getWorkflowParticipantDraftRoleLabel(workflow, draft, index);
  if (!provider || !roleLabel) {
    return null;
  }

  return {
    roleLabel,
    provider,
  };
}

function summarizeRoleCounts(previews) {
  const grouped = new Map();
  for (const preview of previews) {
    grouped.set(preview.roleLabel, (grouped.get(preview.roleLabel) || 0) + 1);
  }

  return [...grouped.entries()]
    .map(([roleLabel, count]) => (count > 1 ? `${roleLabel} ${count}명` : `${roleLabel} 1명`))
    .join(' · ');
}

function summarizeRoleAssignments(previews) {
  const grouped = new Map();

  for (const preview of previews) {
    const key = `${preview.roleLabel}::${preview.provider}`;
    grouped.set(key, {
      roleLabel: preview.roleLabel,
      provider: preview.provider,
      count: (grouped.get(key)?.count || 0) + 1,
    });
  }

  return [...grouped.values()]
    .map((item) => (item.count > 1
      ? `${item.roleLabel}: ${item.provider} ${item.count}명`
      : `${item.roleLabel}: ${item.provider}`))
    .join(' · ');
}

function renderWorkflowTemplateOptions(workflow) {
  const controls = getWorkflowControls(workflow);
  if (!controls.templateSelect) return;

  const templates = getWorkflowTemplates(workflow);
  const options = templates.map((template) => ({
    value: template.id,
    label: template.label,
    disabled: false,
    title: template.description || '',
  }));

  setSelectOptions(controls.templateSelect, options, getDefaultTemplateId(workflow));
}

function ensureWorkflowAssignments(workflow, template) {
  if (!template) {
    workflowRoleAssignments[workflow] = {};
    return;
  }

  const providerOptions = getWorkflowProviderOptions(workflow);
  const firstAvailable = providerOptions.find((option) => !option.disabled)?.value || '';
  const nextAssignments = {};

  for (const role of template.participants || []) {
    const roleId = role.roleId;
    const previous = workflowRoleAssignments[workflow]?.[roleId];
    const preferred = [previous, role.defaultProvider, firstAvailable].find((value) => {
      return providerOptions.some((option) => option.value === value && !option.disabled);
    }) || '';
    nextAssignments[roleId] = preferred;
  }

  workflowRoleAssignments[workflow] = nextAssignments;
}

function renderWorkflowTemplateSummary(workflow) {
  const controls = getWorkflowControls(workflow);
  if (!controls.templateSummary) return;

  const template = getSelectedTemplate(workflow);
  if (!template) {
    controls.templateSummary.innerHTML = '<div class="session-meta">사용 가능한 역할 템플릿이 없습니다.</div>';
    return;
  }

  controls.templateSummary.innerHTML = `
    <div class="template-summary-card">
      <strong>${escapeHtml(template.label)}</strong>
      <p>${escapeHtml(template.description || '')}</p>
      <div class="summary-chip-row">
        ${(template.participants || []).map((role) => `<span class="meta-badge">${escapeHtml(role.label)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderWorkflowRoleSlots(workflow) {
  const controls = getWorkflowControls(workflow);
  if (!controls.roleSlots) return;

  const template = getSelectedTemplate(workflow);
  if (!template) {
    controls.roleSlots.innerHTML = '';
    return;
  }

  ensureWorkflowAssignments(workflow, template);
  const providerOptions = getWorkflowProviderOptions(workflow);

  controls.roleSlots.innerHTML = (template.participants || [])
    .map((role, index) => {
      const roleId = role.roleId || `${workflow}-${index + 1}`;
      const slotValue = workflowRoleAssignments[workflow]?.[roleId] || '';
      const optionMarkup = providerOptions
        .map((option) => {
          const selected = option.value === slotValue ? 'selected' : '';
          const disabled = option.disabled ? 'disabled' : '';
          return `<option value="${escapeHtml(option.value)}" ${selected} ${disabled}>${escapeHtml(option.label)}</option>`;
        })
        .join('');

      return `
        <article class="role-slot-card" data-role-slot="${escapeHtml(roleId)}">
          <div class="role-slot-head">
            <span class="step-badge muted">Role ${index + 1}</span>
            <strong>${escapeHtml(role.label)}</strong>
          </div>
          <p class="role-slot-focus">${escapeHtml(role.focus || '')}</p>
          ${Array.isArray(role.instructions) && role.instructions.length > 0
            ? `<ul class="role-slot-list">${role.instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join('')}</ul>`
            : '<p class="session-meta">추가 역할 지시는 없습니다.</p>'}
          ${Array.isArray(role.requiredQuestions) && role.requiredQuestions.length > 0
            ? `<p class="session-meta">${escapeHtml(role.requiredQuestions.join(' / '))}</p>`
            : ''}
          <label class="field">
            <span>담당 모델</span>
            <select data-role-provider="${escapeHtml(roleId)}">${optionMarkup}</select>
          </label>
        </article>
      `;
    })
    .join('');

  controls.roleSlots.querySelectorAll('select[data-role-provider]').forEach((select) => {
    select.addEventListener('change', async () => {
      const roleId = select.getAttribute('data-role-provider');
      if (!roleId) return;
      workflowRoleAssignments[workflow] = {
        ...workflowRoleAssignments[workflow],
        [roleId]: select.value,
      };
      if (workflow === 'news') {
        await syncNewsOllamaModelField();
      }
    });
  });
}

function renderWorkflowCustomSummary(workflow) {
  const controls = getWorkflowControls(workflow);
  if (!controls.customSummary) return;

  ensureWorkflowCustomParticipants(workflow);
  const previews = (getWorkflowComposerState(workflow).customParticipants || [])
    .map((draft, index) => buildWorkflowCustomParticipantPreview(workflow, draft, index))
    .filter(Boolean);

  if (previews.length === 0) {
    controls.customSummary.innerHTML = '역할과 모델을 선택하면 구성이 여기에 요약됩니다.';
    return;
  }

  controls.customSummary.innerHTML = `
    <strong>현재 custom 구성</strong>
    <div class="participant-summary-grid">
      <div class="participant-summary-row">
        <span>역할 묶음</span>
        <p>${escapeHtml(summarizeRoleCounts(previews))}</p>
      </div>
      <div class="participant-summary-row">
        <span>모델 배치</span>
        <p>${escapeHtml(summarizeRoleAssignments(previews))}</p>
      </div>
    </div>
  `;
}

function renderWorkflowCustomParticipants(workflow) {
  const controls = getWorkflowControls(workflow);
  if (!controls.customRoleSlots) return;

  ensureWorkflowCustomParticipants(workflow);
  const state = getWorkflowComposerState(workflow);
  const providerOptions = getWorkflowProviderOptions(workflow);
  const roleCatalog = getWorkflowRoleCatalog(workflow);

  if (controls.customCountSelect) {
    controls.customCountSelect.value = String(clampParticipantCount(state.customParticipants.length || MIN_PARTICIPANTS));
  }

  controls.customRoleSlots.innerHTML = (state.customParticipants || [])
    .map((draft, index) => {
      const roleDefinition = getWorkflowRoleDefinition(workflow, draft.roleId);
      const roleOptions = roleCatalog
        .map((role) => {
          const selected = role.roleId === draft.roleId ? 'selected' : '';
          return `<option value="${escapeHtml(role.roleId)}" ${selected}>${escapeHtml(role.label)}</option>`;
        })
        .join('');
      const providerMarkup = providerOptions
        .map((option) => {
          const selected = option.value === draft.provider ? 'selected' : '';
          const disabled = option.disabled ? 'disabled' : '';
          return `<option value="${escapeHtml(option.value)}" ${selected} ${disabled}>${escapeHtml(option.label)}</option>`;
        })
        .join('');
      const roleLabel = getWorkflowParticipantDraftRoleLabel(workflow, draft, index);
      const focus = draft.roleId === CUSTOM_ROLE_VALUE
        ? roleLabel
          ? `${roleLabel} 관점에서 질문에 답합니다.`
          : '역할명을 직접 입력하면 그 관점으로 토론에 참여합니다.'
        : roleDefinition?.focus || '';
      const instructions = draft.roleId === CUSTOM_ROLE_VALUE ? [] : roleDefinition?.instructions || [];
      const requiredQuestions = draft.roleId === CUSTOM_ROLE_VALUE ? [] : roleDefinition?.requiredQuestions || [];
      const customRoleField = draft.roleId === CUSTOM_ROLE_VALUE
        ? `
          <label class="field">
            <span>직접 입력 역할명</span>
            <input
              type="text"
              data-custom-role-label="${escapeHtml(index)}"
              placeholder="예: 경제 전문가"
              value="${escapeHtml(draft.customLabel || '')}"
            />
          </label>
        `
        : '';

      return `
        <article class="role-slot-card custom-role-slot" data-custom-slot="${escapeHtml(index)}">
          <div class="role-slot-head">
            <span class="step-badge muted">Participant ${index + 1}</span>
            <strong>${escapeHtml(roleLabel || '역할을 선택하세요')}</strong>
          </div>
          <div class="inline-fields participant-slot-grid">
            <label class="field">
              <span>역할</span>
              <select data-custom-role="${escapeHtml(index)}">${roleOptions}</select>
            </label>
            <label class="field">
              <span>모델</span>
              <select data-custom-provider="${escapeHtml(index)}">${providerMarkup}</select>
            </label>
          </div>
          ${customRoleField}
          <p class="role-slot-focus">${escapeHtml(focus || '역할별 관점이 여기에 표시됩니다.')}</p>
          ${instructions.length > 0
            ? `<ul class="role-slot-list">${instructions.map((instruction) => `<li>${escapeHtml(instruction)}</li>`).join('')}</ul>`
            : '<p class="session-meta">추가 역할 지시는 없습니다.</p>'}
          ${requiredQuestions.length > 0
            ? `<p class="session-meta">${escapeHtml(requiredQuestions.join(' / '))}</p>`
            : ''}
        </article>
      `;
    })
    .join('');

  controls.customRoleSlots.querySelectorAll('select[data-custom-role]').forEach((select) => {
    select.addEventListener('change', async () => {
      const index = Number(select.getAttribute('data-custom-role'));
      if (!Number.isFinite(index)) return;
      const current = getWorkflowComposerState(workflow).customParticipants || [];
      const nextDraft = createCustomParticipantDraft(workflow, index, {
        ...current[index],
        roleId: select.value,
        customLabel: select.value === CUSTOM_ROLE_VALUE ? current[index]?.customLabel || '' : '',
      });
      current[index] = nextDraft;
      workflowParticipantComposer[workflow] = {
        ...getWorkflowComposerState(workflow),
        customParticipants: [...current],
      };
      renderWorkflowCustomParticipants(workflow);
      if (workflow === 'news') {
        await syncNewsOllamaModelField();
      }
    });
  });

  controls.customRoleSlots.querySelectorAll('select[data-custom-provider]').forEach((select) => {
    select.addEventListener('change', async () => {
      const index = Number(select.getAttribute('data-custom-provider'));
      if (!Number.isFinite(index)) return;
      const current = getWorkflowComposerState(workflow).customParticipants || [];
      current[index] = createCustomParticipantDraft(workflow, index, {
        ...current[index],
        provider: select.value,
      });
      workflowParticipantComposer[workflow] = {
        ...getWorkflowComposerState(workflow),
        customParticipants: [...current],
      };
      renderWorkflowCustomSummary(workflow);
      if (workflow === 'news') {
        await syncNewsOllamaModelField();
      }
    });
  });

  controls.customRoleSlots.querySelectorAll('input[data-custom-role-label]').forEach((input) => {
    input.addEventListener('input', () => {
      const index = Number(input.getAttribute('data-custom-role-label'));
      if (!Number.isFinite(index)) return;
      const current = getWorkflowComposerState(workflow).customParticipants || [];
      current[index] = createCustomParticipantDraft(workflow, index, {
        ...current[index],
        roleId: CUSTOM_ROLE_VALUE,
        customLabel: input.value,
      });
      workflowParticipantComposer[workflow] = {
        ...getWorkflowComposerState(workflow),
        customParticipants: [...current],
      };
      const card = input.closest('[data-custom-slot]');
      const nextLabel = getWorkflowParticipantDraftRoleLabel(workflow, current[index], index) || '역할을 선택하세요';
      const title = card?.querySelector('.role-slot-head strong');
      const focus = card?.querySelector('.role-slot-focus');
      if (title) {
        title.textContent = nextLabel;
      }
      if (focus) {
        focus.textContent = nextLabel
          ? `${nextLabel} 관점에서 질문에 답합니다.`
          : '역할명을 직접 입력하면 그 관점으로 토론에 참여합니다.';
      }
      renderWorkflowCustomSummary(workflow);
    });
  });

  renderWorkflowCustomSummary(workflow);
}

function renderWorkflowComposer(workflow) {
  const controls = getWorkflowControls(workflow);
  const mode = getWorkflowMode(workflow);
  controls.templatePanel?.classList.toggle('collapsed', mode !== 'template');
  controls.customPanel?.classList.toggle('collapsed', mode !== 'custom');

  controls.participantMode?.querySelectorAll('[data-participant-mode]').forEach((button) => {
    const isActive = button.getAttribute('data-participant-mode') === mode;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function renderWorkflowTemplateEditor(workflow) {
  renderWorkflowTemplateOptions(workflow);
  const template = getSelectedTemplate(workflow);
  const controls = getWorkflowControls(workflow);
  if (template?.recommendedJudge && controls.judgeSelect && getWorkflowMode(workflow) === 'template') {
    const judgeOptions = getWorkflowJudgeOptions(workflow);
    if (judgeOptions.some((option) => option.value === template.recommendedJudge && !option.disabled)) {
      controls.judgeSelect.value = template.recommendedJudge;
    }
  }
  renderWorkflowTemplateSummary(workflow);
  renderWorkflowRoleSlots(workflow);
  renderWorkflowCustomParticipants(workflow);
  renderWorkflowComposer(workflow);
}

function renderAllWorkflowTemplateEditors() {
  ['project', 'news'].forEach((workflow) => {
    renderWorkflowTemplateEditor(workflow);
  });
}

function buildParticipantsFromTemplateWorkflow(workflow) {
  const template = getSelectedTemplate(workflow);
  if (!template) {
    return [];
  }

  return (template.participants || []).map((role, index) => {
    const roleId = role.roleId || `${workflow}-${index + 1}`;
    const provider = workflowRoleAssignments[workflow]?.[roleId] || role.defaultProvider || '';
    return {
      id: `${workflow}-${template.id}-${roleId}`,
      provider,
      label: role.label,
      role: {
        roleId,
        roleLabel: role.label,
        focus: role.focus || '',
        instructions: Array.isArray(role.instructions) ? role.instructions : [],
        requiredQuestions: Array.isArray(role.requiredQuestions) ? role.requiredQuestions : [],
      },
    };
  }).filter((participant) => participant.provider);
}

function buildParticipantsFromCustomWorkflow(workflow) {
  ensureWorkflowCustomParticipants(workflow);

  return (getWorkflowComposerState(workflow).customParticipants || [])
    .map((draft, index) => {
      const roleDefinition = getWorkflowRoleDefinition(workflow, draft.roleId);
      const roleLabel = getWorkflowParticipantDraftRoleLabel(workflow, draft, index);
      if (!draft.provider || !roleLabel) {
        return null;
      }

      const baseRoleId = draft.roleId === CUSTOM_ROLE_VALUE
        ? slugifyValue(roleLabel) || `custom-role-${index + 1}`
        : roleDefinition?.roleId || `participant-${index + 1}`;

      return {
        id: `${workflow}-custom-${index + 1}-${slugifyValue(roleLabel) || 'participant'}`,
        provider: draft.provider,
        label: roleLabel,
        role: {
          roleId: `${baseRoleId}-${index + 1}`,
          roleLabel,
          focus: roleDefinition?.focus || `${roleLabel} 관점에서 질문에 답합니다.`,
          instructions: Array.isArray(roleDefinition?.instructions) ? roleDefinition.instructions : [],
          requiredQuestions: Array.isArray(roleDefinition?.requiredQuestions) ? roleDefinition.requiredQuestions : [],
        },
      };
    })
    .filter(Boolean);
}

function buildParticipantsFromWorkflow(workflow) {
  if (getWorkflowMode(workflow) === 'custom') {
    return buildParticipantsFromCustomWorkflow(workflow);
  }

  return buildParticipantsFromTemplateWorkflow(workflow);
}

function resolveWorkflowParticipants(workflow) {
  if (getWorkflowMode(workflow) === 'custom') {
    ensureWorkflowCustomParticipants(workflow);
    const drafts = getWorkflowComposerState(workflow).customParticipants || [];

    for (const [index, draft] of drafts.entries()) {
      if (!String(draft.provider || '').trim()) {
        return { ok: false, error: `${index + 1}번 참가자의 모델을 선택하세요.` };
      }

      if (!getWorkflowParticipantDraftRoleLabel(workflow, draft, index)) {
        return { ok: false, error: `${index + 1}번 참가자의 역할을 선택하거나 직접 입력하세요.` };
      }
    }
  }

  const participants = buildParticipantsFromWorkflow(workflow);
  if (participants.length < MIN_PARTICIPANTS || participants.length > MAX_PARTICIPANTS) {
    return { ok: false, error: `${workflow === 'news' ? '뉴스' : '프로젝트'} 토론 참가자는 2명에서 6명 사이여야 합니다.` };
  }

  return { ok: true, participants };
}

async function refreshRoleTemplates() {
  const { ok, data } = await fetchJson('/api/roles');
  if (!ok) {
    if (executeStatus) {
      executeStatus.textContent = data.error || '역할 템플릿을 불러오지 못했습니다.';
    }
    return;
  }

  roleTemplateConfig = data.config || null;
  roleTemplateDefaults = data.defaults || { project: '', news: '' };
  renderAllWorkflowTemplateEditors();
}

function renderRoleConfigPreviewMarkup(config) {
  if (!config?.workflows) {
    return '<p class="session-meta">역할 설정을 미리보기할 수 없습니다.</p>';
  }

  return ['project', 'news']
    .map((workflow) => {
      const templates = config.workflows?.[workflow]?.templates || [];
      if (templates.length === 0) {
        return '';
      }

      return `
        <section class="role-config-preview-section">
          <h3>${workflow === 'project' ? '프로젝트 개선' : '뉴스 기반 토론'}</h3>
          ${templates.map((template) => `
            <article class="role-config-preview-card">
              <strong>${escapeHtml(template.label)}</strong>
              <p>${escapeHtml(template.description || '')}</p>
              <div class="summary-chip-row">
                ${(template.participants || []).map((role) => `<span class="meta-badge">${escapeHtml(role.label)}</span>`).join('')}
              </div>
            </article>
          `).join('')}
        </section>
      `;
    })
    .join('');
}

async function refreshRoleConfigEditor() {
  if (!roleConfigEditor) return;

  const { ok, data } = await fetchJson('/api/roles/config');
  if (!ok) {
    if (roleConfigStatus) {
      roleConfigStatus.textContent = data.error || '역할 설정 YAML을 불러오지 못했습니다.';
    }
    return;
  }

  roleTemplateConfig = data.config || null;
  roleTemplateDefaults = data.defaults || { project: '', news: '' };
  roleConfigEditor.value = data.raw || '';
  roleConfigDefaultRaw = data.defaultRaw || '';
  if (roleConfigPath) {
    roleConfigPath.textContent = data.path || '';
  }
  if (roleConfigMeta) {
    roleConfigMeta.textContent = '로컬 override가 있으면 우선 적용되고, 없으면 기본 템플릿을 사용합니다.';
  }
  if (roleConfigRevision) {
    roleConfigRevision.textContent = '로드 완료';
  }
  if (roleConfigPreview.news) {
    roleConfigPreview.news.innerHTML = renderRoleConfigPreviewMarkup({
      workflows: { news: data.config?.workflows?.news || { templates: [] } },
    });
  }
  if (roleConfigPreview.project) {
    roleConfigPreview.project.innerHTML = renderRoleConfigPreviewMarkup({
      workflows: { project: data.config?.workflows?.project || { templates: [] } },
    });
  }
  if (roleConfigValidation) {
    roleConfigValidation.textContent = 'YAML을 수정한 뒤 저장하면 여기에서 결과를 확인합니다.';
  }
}

async function saveRoleConfigEditor() {
  if (!roleConfigEditor) return;

  const { ok, data } = await fetchJson('/api/roles/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: roleConfigEditor.value }),
  });

  if (!ok) {
    if (roleConfigStatus) {
      roleConfigStatus.textContent = data.error || '역할 설정 저장에 실패했습니다.';
    }
    if (roleConfigValidation) {
      roleConfigValidation.textContent = data.error || '역할 설정 저장에 실패했습니다.';
    }
    return;
  }

  if (roleConfigStatus) {
    roleConfigStatus.textContent = `저장 완료 · ${data.path || ''}`;
  }

  roleTemplateConfig = data.config || null;
  roleTemplateDefaults = data.defaults || { project: '', news: '' };
  roleConfigDefaultRaw = data.defaultRaw || roleConfigDefaultRaw;
  if (roleConfigRevision) {
    roleConfigRevision.textContent = '저장됨';
  }
  if (roleConfigValidation) {
    roleConfigValidation.textContent = '유효성 검사 통과. YAML 저장이 완료되었습니다.';
  }
  if (roleConfigPreview.news) {
    roleConfigPreview.news.innerHTML = renderRoleConfigPreviewMarkup({
      workflows: { news: data.config?.workflows?.news || { templates: [] } },
    });
  }
  if (roleConfigPreview.project) {
    roleConfigPreview.project.innerHTML = renderRoleConfigPreviewMarkup({
      workflows: { project: data.config?.workflows?.project || { templates: [] } },
    });
  }
  await refreshRoleTemplates();
}

function renderSessions(sessions) {
  if (!sessionList) return;

  const visibleSessions = (sessions || []).filter((session) => pageAllowsWorkflow(session.workflowKind));

  if (visibleSessions.length === 0) {
    sessionList.innerHTML = '<p class="session-meta">아직 생성된 세션이 없습니다.</p>';
    return;
  }

  sessionList.innerHTML = visibleSessions
    .map((session) => {
      const active = session.sessionId === activeSessionId ? 'active' : '';
      const evidenceBadge = session.evidence
        ? `<span class="meta-badge">Evidence ${escapeHtml(session.evidence.id)}</span>`
        : '';
      const workspaceBadge = session.executionCwd
        ? `<span class="meta-badge">${escapeHtml(shortPath(session.executionCwd))}</span>`
        : '';
      const ollamaModelBadge = session.ollamaModel
        ? `<span class="meta-badge">Ollama ${escapeHtml(session.ollamaModel)}</span>`
        : '';
      const workflowMeta = getWorkflowMeta(session.workflowKind);
      const participantLabel = formatParticipantsInline(session.participants);

      return `
        <div class="session-item ${active}" data-session-id="${escapeHtml(session.sessionId)}">
          <div class="session-item-head">
            <div class="session-tags">
              <span class="status-chip ${statusToClass(session.status)}">${escapeHtml(session.status)}</span>
              <span class="meta-badge workflow-chip ${workflowMeta.className}">${escapeHtml(workflowMeta.label)}</span>
            </div>
            <span class="session-meta">${escapeHtml(formatTime(session.updatedAt))}</span>
          </div>
          <div class="session-question">${escapeHtml(session.question)}</div>
          <div class="session-tags">
            ${participantLabel ? `<span class="meta-badge">${escapeHtml(participantLabel)}</span>` : ''}
            ${evidenceBadge}
            ${workspaceBadge}
            ${ollamaModelBadge}
          </div>
          <div class="session-meta-row">
            <span class="session-meta">${escapeHtml(session.eventCount)} events · ${escapeHtml(formatDateTime(session.createdAt))}</span>
          </div>
        </div>
      `;
    })
    .join('');

  sessionList.querySelectorAll('.session-item').forEach((item) => {
    item.addEventListener('click', () => {
      const sessionId = item.getAttribute('data-session-id');
      if (sessionId) {
        void selectSession(sessionId);
      }
    });
  });
}

function renderSessionBrief() {
  if (!sessionBrief) return;

  if (!activeSessionSummary) {
    sessionBrief.className = 'session-context';
    sessionBrief.innerHTML = `
      <div class="empty-state">
        <strong>선택된 세션이 없습니다.</strong>
        <p>프로젝트 개선 또는 뉴스 토론을 시작하거나, 아래 세션을 선택하세요.</p>
      </div>
    `;
    return;
  }

  const evidence = activeSessionSummary.evidence;
  const workspace = activeSessionSummary.executionCwd;
  const workflowMeta = getWorkflowMeta(activeSessionSummary.workflowKind);
  const participantLabel = formatParticipantsInline(activeSessionSummary.participants);

  sessionBrief.className = 'session-context';
  sessionBrief.innerHTML = `
    <div class="context-card">
      <div class="session-brief-head">
        <div class="session-title"><strong>${escapeHtml(activeSessionSummary.question)}</strong></div>
        <span class="status-chip ${statusToClass(activeSessionSummary.status)}">${escapeHtml(activeSessionSummary.status)}</span>
      </div>
      <div class="session-tags">
        <span class="meta-badge workflow-chip ${workflowMeta.className}">${escapeHtml(workflowMeta.label)}</span>
        ${participantLabel ? `<span class="meta-badge">${escapeHtml(participantLabel)}</span>` : ''}
        ${activeSessionSummary.judge ? `<span class="meta-badge">Judge ${escapeHtml(activeSessionSummary.judge)}</span>` : ''}
        ${workspace ? `<span class="meta-badge">${escapeHtml(shortPath(workspace))}</span>` : ''}
        ${evidence ? `<span class="meta-badge">Evidence ${escapeHtml(evidence.id)}</span>` : '<span class="meta-badge">Evidence 없음</span>'}
        ${activeSessionSummary.ollamaModel ? `<span class="meta-badge">Ollama ${escapeHtml(activeSessionSummary.ollamaModel)}</span>` : ''}
      </div>
      <div class="session-description">
        ${workflowMeta.label} 흐름에서 생성된 세션입니다.
        ${workspace
          ? ` 실행 경로는 <code>${escapeHtml(workspace)}</code>입니다.`
          : ' 별도 실행 경로는 지정되지 않았습니다.'}
        ${evidence
          ? ` 연결된 근거 팩은 "${escapeHtml(evidence.query)}" (${escapeHtml(evidence.articleCount)}건)입니다.`
          : ' 근거 팩은 연결되지 않았습니다.'}
      </div>
    </div>
  `;
}

function renderSnapshotSummary(title, summary, buttons = '') {
  const sourceCount = Array.isArray(summary?.sources) ? summary.sources.length : 0;
  const collectedAt = summary?.collectedAt ? formatDate(summary.collectedAt) : '';
  const articleCount = typeof summary?.articleCount === 'number'
    ? summary.articleCount
    : Array.isArray(summary?.articles)
      ? summary.articles.length
      : null;
  const topDomains = Array.isArray(summary?.topDomains) ? summary.topDomains.slice(0, 2) : [];

  return `
    <div class="selected-evidence-title"><strong>${escapeHtml(title)}</strong></div>
    <div class="summary-chip-row">
      ${summary?.id ? `<span class="meta-badge">${escapeHtml(summary.id)}</span>` : ''}
      ${collectedAt ? `<span class="meta-badge">${escapeHtml(collectedAt)}</span>` : ''}
      ${articleCount !== null ? `<span class="meta-badge">${escapeHtml(articleCount)}건</span>` : ''}
      ${sourceCount ? `<span class="meta-badge">sources ${escapeHtml(sourceCount)}</span>` : ''}
      ${typeof summary?.excludedCount === 'number' ? `<span class="meta-badge">excluded ${escapeHtml(summary.excludedCount)}</span>` : ''}
      ${topDomains.map((domain) => `<span class="meta-badge">${escapeHtml(domain)}</span>`).join('')}
    </div>
    ${buttons}
  `;
}

function renderSelectedEvidence() {
  if (!selectedEvidence) return;

  if (!selectedSnapshotId) {
    selectedEvidence.className = 'selected-evidence-card empty';
    selectedEvidence.innerHTML = '<div class="selected-evidence-empty">선택된 뉴스 근거 팩이 없습니다. 뉴스 토론 시작 시 자동 수집하거나, 아래 라이브러리에서 선택할 수 있습니다.</div>';
    return;
  }

  const summary = cachedSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || snapshotDetailCache.get(selectedSnapshotId);
  const title = summary?.query || selectedSnapshotId;

  selectedEvidence.className = 'selected-evidence-card';
  selectedEvidence.innerHTML = renderSnapshotSummary(
    title,
    summary,
    `
      <div class="snapshot-actions">
        <button class="button subtle mini-button" type="button" data-action="view-selected">기사 보기</button>
        <button class="button subtle mini-button" type="button" data-action="clear-selected">해제</button>
      </div>
    `
  );

  selectedEvidence.querySelector('[data-action="view-selected"]')?.addEventListener('click', () => {
    void viewSnapshot(selectedSnapshotId);
  });

  selectedEvidence.querySelector('[data-action="clear-selected"]')?.addEventListener('click', () => {
    clearSelectedSnapshot();
  });
}

function renderEvidencePackItems(detail) {
  const articles = Array.isArray(detail?.articles) ? detail.articles.slice(0, 5) : [];
  if (articles.length === 0) {
    return '<p class="session-meta">연결된 기사 목록을 아직 불러오지 못했습니다.</p>';
  }

  return articles
    .map((article) => {
      const title = article.url
        ? `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title || article.url)}</a>`
        : escapeHtml(article.title || '제목 없음');
      const domain = extractDomain(article.url);
      const date = article.publishedAt ? String(article.publishedAt).slice(0, 10) : '';

      return `
        <div class="evidence-pack-item">
          <div class="evidence-pack-item-title">${title}</div>
          <div class="evidence-chip-row">
            ${article.source ? `<span class="meta-badge">${escapeHtml(article.source)}</span>` : ''}
            ${domain ? `<span class="meta-badge">${escapeHtml(domain)}</span>` : ''}
            ${date ? `<span class="meta-badge">${escapeHtml(date)}</span>` : ''}
          </div>
          <div class="evidence-pack-item-summary">${escapeHtml(article.summary || '')}</div>
        </div>
      `;
    })
    .join('');
}

function getDisplayedEvidenceSummary() {
  if (activeSessionSummary?.evidence) {
    return activeSessionSummary.evidence;
  }

  if (selectedSnapshotId) {
    return cachedSnapshots.find((snapshot) => snapshot.id === selectedSnapshotId) || snapshotDetailCache.get(selectedSnapshotId);
  }

  return null;
}

function getDisplayedEvidenceId() {
  return activeSessionSummary?.evidence?.id || selectedSnapshotId;
}

function renderEvidencePack() {
  if (!evidencePack) return;

  const summary = getDisplayedEvidenceSummary();
  const detail = summary?.id ? snapshotDetailCache.get(summary.id) : null;

  if (!summary) {
    evidencePack.className = 'evidence-pack empty';
    evidencePack.innerHTML = '근거 팩을 선택하거나, 근거가 연결된 세션을 열면 source / date / domain이 이곳에 표시됩니다.';
    return;
  }

  evidencePack.className = 'evidence-pack';
  evidencePack.innerHTML = `
    ${renderSnapshotSummary(summary.query || summary.id, summary)}
    ${renderEvidencePackItems(detail || summary)}
  `;
}

async function loadSnapshotDetail(snapshotId) {
  if (!snapshotId) return null;
  if (snapshotDetailCache.has(snapshotId)) {
    return snapshotDetailCache.get(snapshotId);
  }

  const { ok, data } = await fetchJson(`/api/snapshots/${encodeURIComponent(snapshotId)}`);
  if (!ok) {
    return null;
  }

  snapshotDetailCache.set(snapshotId, data);
  return data;
}

async function syncDisplayedEvidence() {
  const evidenceId = getDisplayedEvidenceId();
  if (evidenceId) {
    await loadSnapshotDetail(evidenceId);
  }

  renderSelectedEvidence();
  renderEvidencePack();
}

function renderSnapshots(snapshots) {
  if (!snapshotList) return;

  if (!snapshots || snapshots.length === 0) {
    snapshotList.innerHTML = '<p class="session-meta">저장된 근거 팩이 없습니다.</p>';
    return;
  }

  snapshotList.innerHTML = snapshots
    .map((snapshot) => {
      const isSelected = snapshot.id === selectedSnapshotId ? 'selected' : '';
      const sourceCount = Array.isArray(snapshot.sources) ? snapshot.sources.length : '?';

      return `
        <div class="snapshot-item ${isSelected}" data-snap-id="${escapeHtml(snapshot.id)}">
          <div class="snapshot-item-header">
            <div>
              <div class="snapshot-id">${escapeHtml(snapshot.id)}</div>
              <div class="snapshot-query">${escapeHtml(snapshot.query || 'Untitled evidence pack')}</div>
            </div>
            <span class="session-meta">${escapeHtml(formatDate(snapshot.createdAt))}</span>
          </div>
          <div class="summary-chip-row">
            <span class="meta-badge">${escapeHtml(snapshot.articleCount ?? 0)}건</span>
            <span class="meta-badge">sources ${escapeHtml(sourceCount)}</span>
          </div>
          <div class="snapshot-actions">
            <button class="button mini-button" type="button" data-action="use" data-snap-id="${escapeHtml(snapshot.id)}">선택</button>
            <button class="button subtle mini-button" type="button" data-action="view" data-snap-id="${escapeHtml(snapshot.id)}">보기</button>
            <button class="button subtle mini-button" type="button" data-action="delete" data-snap-id="${escapeHtml(snapshot.id)}">삭제</button>
          </div>
        </div>
      `;
    })
    .join('');

  snapshotList.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const action = button.getAttribute('data-action');
      const snapshotId = button.getAttribute('data-snap-id');
      if (!snapshotId) return;

      if (action === 'use') {
        void useSnapshot(snapshotId);
      } else if (action === 'view') {
        void viewSnapshot(snapshotId);
      } else if (action === 'delete') {
        void deleteSnapshot(snapshotId);
      }
    });
  });
}

async function refreshSnapshots() {
  if (!snapshotList) return;

  snapshotList.innerHTML = '<p class="session-meta">근거 팩을 불러오는 중입니다...</p>';
  const { ok, data } = await fetchJson('/api/snapshots');
  if (!ok) {
    snapshotList.innerHTML = '<p class="session-meta">근거 팩 목록을 불러오지 못했습니다.</p>';
    return;
  }

  cachedSnapshots = data.snapshots || [];
  renderSnapshots(cachedSnapshots);
  renderSelectedEvidence();
  renderEvidencePack();
}

async function useSnapshot(snapshotId) {
  selectedSnapshotId = snapshotId;
  if (debateSnapshotInput) {
    debateSnapshotInput.value = snapshotId;
  }
  await loadSnapshotDetail(snapshotId);
  if (newsCollectStatus) {
    newsCollectStatus.textContent = `근거 팩 ${snapshotId}를 뉴스 토론에 연결했습니다.`;
  }
  renderSnapshots(cachedSnapshots);
  renderSelectedEvidence();
  renderEvidencePack();
}

function clearSelectedSnapshot() {
  selectedSnapshotId = null;
  if (debateSnapshotInput) {
    debateSnapshotInput.value = '';
  }
  if (newsCollectStatus) {
    newsCollectStatus.textContent = '뉴스 근거 팩 연결을 해제했습니다.';
  }
  renderSnapshots(cachedSnapshots);
  renderSelectedEvidence();
  renderEvidencePack();
}

async function viewSnapshot(snapshotId) {
  if (!modalTitle || !articleModal || !modalBody) return;

  const detail = await loadSnapshotDetail(snapshotId);

  modalTitle.textContent = `기사 목록 · ${snapshotId}`;
  articleModal.style.display = 'flex';

  if (!detail || !Array.isArray(detail.articles) || detail.articles.length === 0) {
    modalBody.innerHTML = '<p class="session-meta">표시할 기사가 없습니다.</p>';
    return;
  }

  modalBody.innerHTML = detail.articles
    .map((article) => {
      const title = article.url
        ? `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title || article.url)}</a>`
        : escapeHtml(article.title || '제목 없음');
      const domain = extractDomain(article.url);
      const date = article.publishedAt ? String(article.publishedAt).slice(0, 10) : '';

      return `
        <div class="article-item">
          <div class="article-title">${title}</div>
          <div class="article-meta">${escapeHtml(article.source || '')}${domain ? ` · ${escapeHtml(domain)}` : ''}${date ? ` · ${escapeHtml(date)}` : ''}</div>
          <div class="article-snippet">${escapeHtml(article.summary || '')}</div>
        </div>
      `;
    })
    .join('');
}

async function viewCurrentEvidence() {
  const evidenceId = getDisplayedEvidenceId();
  if (!evidenceId) {
    executeStatus.textContent = '먼저 뉴스 근거 팩을 선택하거나, 근거가 연결된 세션을 여세요.';
    return;
  }

  await viewSnapshot(evidenceId);
}

async function deleteSnapshot(snapshotId) {
  if (!confirm(`근거 팩 "${snapshotId}"를 삭제하시겠습니까?`)) {
    return;
  }

  const { ok, data } = await fetchJson(`/api/snapshots/${encodeURIComponent(snapshotId)}`, { method: 'DELETE' });
  if (!ok) {
    newsCollectStatus.textContent = data.error || '근거 팩 삭제에 실패했습니다.';
    return;
  }

  if (selectedSnapshotId === snapshotId) {
    clearSelectedSnapshot();
  }

  snapshotDetailCache.delete(snapshotId);
  newsCollectStatus.textContent = `근거 팩 ${snapshotId}를 삭제했습니다.`;
  await refreshSnapshots();
}

function handleEnvelope(envelope) {
  if (renderedSequences.has(envelope.sequence)) {
    return;
  }

  renderedSequences.add(envelope.sequence);
  lastSequence = Math.max(lastSequence, envelope.sequence);
  startStalledTimer();

  if (connState === 'reconnecting' || connState === 'connecting') {
    setConnState('live');
  }

  const { event } = envelope;

  if (event.type === 'round_started') {
    const total = event.payload.total || event.payload.totalRounds || totalRounds;
    updateRoundProgress(event.payload.round, total);
    addTimelineEntry(`Round ${event.payload.round} 시작 · ${formatTime(event.timestamp)}`, 'round-start');
  }

  if (event.type === 'agent_chunk') {
    appendBubble(
      event.payload.participantId || event.payload.provider,
      event.payload.label || event.payload.provider,
      event.payload.provider,
      event.payload.token,
    );
  }

  if (event.type === 'round_finished') {
    stopTyping();
    addTimelineEntry(`Round ${event.payload.round} 완료 · ${event.payload.messages.length}개 메시지`, 'round-end');
  }

  if (event.type === 'round_state_ready') {
    upsertRoundState(event.payload);
    renderDecisionBoard();
    addTimelineEntry(`Round ${event.payload.round} 보드 업데이트`, event.payload.transcriptFallbackUsed ? 'error' : 'round-end');
  }

  if (event.type === 'synthesis_ready') {
    if (event.payload.status === 'started') {
      synthesisContent = 'Synthesizing...';
    } else if (event.payload.content) {
      synthesisContent = event.payload.content;
      stopTyping();
    }
    renderSynthesis();
  }

  if (event.type === 'error') {
    addTimelineEntry(`오류: ${event.payload.code}`, 'error');
    setConnState('stalled');
  }

  if (event.type === 'cancelled') {
    addTimelineEntry(`세션 취소: ${event.payload.reason}`, 'error');
    setConnState('idle');
    stopTyping();
    if (roundProgress) {
      roundProgress.style.display = 'none';
    }
  }
}

async function replayEvents(fromSequence) {
  if (!activeSessionId) return;

  const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=${fromSequence}`);
  if (!ok) {
    return;
  }

  if (data.hasGap && fromSequence > 1) {
    if (gapBanner) {
      gapBanner.style.display = 'block';
      setTimeout(() => {
        gapBanner.style.display = 'none';
      }, 5000);
    }

    const { ok: fullOk, data: fullData } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=1`);
    if (fullOk) {
      fullData.events.forEach(handleEnvelope);
    }
    return;
  }

  data.events.forEach(handleEnvelope);
}

function connectStream(sessionId) {
  if (eventSource) {
    eventSource.close();
  }

  setConnState('connecting');
  eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

  eventSource.addEventListener('debate', (event) => {
    try {
      handleEnvelope(JSON.parse(event.data));
    } catch {
      // ignore malformed event
    }
  });

  eventSource.addEventListener('hello', () => {
    setConnState('live');
    startStalledTimer();
  });

  eventSource.addEventListener('ping', () => {
    startStalledTimer();
    if (connState === 'stalled' || connState === 'reconnecting') {
      setConnState('live');
    }
  });

  eventSource.onopen = () => {
    setConnState('live');
    startStalledTimer();
  };

  eventSource.onerror = () => {
    setConnState('reconnecting');
  };
}

function resetLivePanels() {
  lastSequence = 0;
  renderedSequences = new Set();
  bubbleMessages = [];
  timelineEntries = [];
  synthesisContent = '';
  latestRoundState = null;
  roundStateHistory = [];
  selectedRoundNumber = null;
  if (roundProgress) {
    roundProgress.style.display = 'none';
  }
  renderBubbles();
  renderTimeline();
  renderDecisionBoard();
  renderSynthesis();
}

async function selectSession(sessionId) {
  activeSessionId = sessionId;
  activeSessionSummary = cachedSessions.find(
    (session) => session.sessionId === sessionId && pageAllowsWorkflow(session.workflowKind)
  ) || null;
  resetLivePanels();

  currentParticipants = normalizeParticipants(activeSessionSummary?.participants);
  if (currentParticipants.length === 0) {
    currentParticipants = [
      createFallbackParticipant('codex', 'codex-default', 'Codex'),
      createFallbackParticipant('claude', 'claude-default', 'Claude'),
    ];
  }
  renderParticipantLanes();

  renderSessions(cachedSessions);
  renderSessionBrief();
  await syncDisplayedEvidence();
  await replayEvents(1);
  connectStream(sessionId);
}

async function refreshSessions() {
  const { ok, data } = await fetchJson('/api/sessions');
  if (!ok) return;

  cachedSessions = data.sessions || [];
  activeSessionSummary = cachedSessions.find(
    (session) => session.sessionId === activeSessionId && pageAllowsWorkflow(session.workflowKind)
  ) || null;
  renderSessions(cachedSessions);
  renderSessionBrief();
  await syncDisplayedEvidence();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

function resolveAttachmentKind(file) {
  if (file.type && file.type.startsWith('image/')) return 'image';
  return 'text';
}

async function buildQuestionAttachments(fileList) {
  const files = Array.from(fileList || []).slice(0, MAX_FILES);
  const attachments = [];
  const warnings = [];

  for (const file of files) {
    const kind = resolveAttachmentKind(file);

    try {
      if (kind === 'image') {
        const dataUrl = await fileToDataUrl(file);
        const content = dataUrl.slice(0, MAX_IMAGE_DATA_URL_CHARS);
        attachments.push({ name: file.name, kind, mimeType: file.type || 'image/unknown', content });
        if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) warnings.push(`${file.name}: image payload truncated`);
        continue;
      }

      const text = await file.text();
      const content = text.slice(0, MAX_TEXT_FILE_CHARS);
      attachments.push({ name: file.name, kind, mimeType: file.type || 'text/plain', content });
      if (text.length > MAX_TEXT_FILE_CHARS) warnings.push(`${file.name}: text truncated`);
    } catch {
      warnings.push(`${file.name}: failed to read`);
    }
  }

  return { attachments, warnings };
}

function buildProviderOptionLabel(provider) {
  return provider.available ? provider.label : `${provider.label} (unavailable)`;
}

function setSelectOptions(select, options, preferredValue) {
  if (!select) return;

  const previous = select.value;
  select.innerHTML = options
    .map((option) => {
      const disabled = option.disabled ? 'disabled' : '';
      const title = option.title ? `title="${escapeHtml(option.title)}"` : '';
      return `<option value="${option.value}" ${disabled} ${title}>${escapeHtml(option.label)}</option>`;
    })
    .join('');

  const finalValue = options.some((option) => option.value === previous && !option.disabled)
    ? previous
    : options.some((option) => option.value === preferredValue && !option.disabled)
      ? preferredValue
      : options.find((option) => !option.disabled)?.value;

  if (finalValue) {
    select.value = finalValue;
  }
}

function getConfiguredWorkflowProviders(workflow) {
  if (getWorkflowMode(workflow) === 'custom') {
    ensureWorkflowCustomParticipants(workflow);
    return (getWorkflowComposerState(workflow).customParticipants || [])
      .map((draft) => String(draft.provider || '').trim())
      .filter(Boolean);
  }

  return Object.values(workflowRoleAssignments[workflow] || {}).filter(Boolean);
}

function shouldShowNewsOllamaModel() {
  const roleValues = getConfiguredWorkflowProviders('news');
  return [...roleValues, newsJudgeSelect?.value].includes('ollama');
}

function renderOllamaModelOptions(models, preferredValue = '') {
  if (!newsOllamaModelSelect) return;

  const options = Array.isArray(models) ? models : [];
  const previous = preferredValue || newsOllamaModelSelect.value;

  if (options.length === 0) {
    newsOllamaModelSelect.innerHTML = '<option value="">사용 가능한 모델이 없습니다</option>';
    newsOllamaModelSelect.disabled = true;
    return;
  }

  newsOllamaModelSelect.innerHTML = [
    '<option value="">모델을 선택하세요</option>',
    ...options.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name || model.id)}</option>`),
  ].join('');
  newsOllamaModelSelect.disabled = false;

  if (previous && options.some((model) => model.id === previous)) {
    newsOllamaModelSelect.value = previous;
  }
}

async function refreshOllamaModels() {
  if (!newsOllamaModelSelect) return;

  const previousValue = newsOllamaModelSelect.value;
  newsOllamaModelSelect.disabled = true;
  newsOllamaModelSelect.innerHTML = '<option value="">모델을 불러오는 중입니다...</option>';

  const { ok, data } = await fetchJson('/api/providers/ollama/models');
  if (!ok) {
    cachedOllamaModels = [];
    newsOllamaModelSelect.innerHTML = '<option value="">모델 목록을 불러오지 못했습니다</option>';
    newsOllamaModelSelect.disabled = true;
    if (newsCollectStatus) {
      newsCollectStatus.textContent = data.error || 'Ollama 모델 목록을 불러오지 못했습니다.';
    }
    return;
  }

  cachedOllamaModels = data.models || [];
  renderOllamaModelOptions(cachedOllamaModels, previousValue);
}

async function syncNewsOllamaModelField() {
  if (!newsOllamaModelGroup) return;

  const visible = shouldShowNewsOllamaModel();
  newsOllamaModelGroup.classList.toggle('collapsed', !visible);

  if (!visible && newsOllamaModelSelect) {
    newsOllamaModelSelect.value = '';
    return;
  }

  if (visible && cachedOllamaModels.length === 0) {
    await refreshOllamaModels();
  }
}

async function refreshProviderOptions() {
  const { ok, data } = await fetchJson('/api/providers');
  if (!ok) return;

  cachedProviderOptions = (data.providers || []).map((provider) => ({
    value: provider.name,
    label: buildProviderOptionLabel(provider),
    disabled: !provider.available,
    title: provider.reason || '',
  }));

  const judgeProviderNames = (data.judgeOptions || []).filter((value) => value !== 'both');
  const judgeProviderOptions = judgeProviderNames.length > 0
    ? judgeProviderNames.map((name) => {
        const match = cachedProviderOptions.find((option) => option.value === name);
        return match || { value: name, label: name, disabled: false, title: '' };
      })
    : cachedProviderOptions;

  cachedJudgeOptions = [
    ...judgeProviderOptions,
    { value: 'both', label: 'both', disabled: false, title: 'Prefer Claude as synthesizer' },
  ];
  setSelectOptions(projectJudgeSelect, getWorkflowJudgeOptions('project'), 'claude');
  setSelectOptions(newsJudgeSelect, getWorkflowJudgeOptions('news'), 'claude');
  renderAllWorkflowTemplateEditors();
  await syncNewsOllamaModelField();
}

function toInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number);
}

async function executeRunDebate(payload) {
  const { ok, data } = await fetchJson('/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!ok) {
    executeStatus.textContent = data.error || '토론 실행에 실패했습니다.';
    return { ok: false, data };
  }

  executeStatus.textContent = `세션 ${data.sessionId} 시작됨 · 타임아웃 ${Math.round((data.timeoutMs || 0) / 1000)}초`;
  await refreshSessions();
  if (data.sessionId) {
    await selectSession(data.sessionId);
  }
  return { ok: true, data };
}

async function collectSnapshotFromNewsForm(options = { autoSelect: true, silent: false }) {
  if (!newsForm) {
    return { ok: false, snapshotId: '' };
  }

  const formData = new FormData(newsForm);
  const query = String(formData.get('query') || '').trim();

  if (!query) {
    if (!options.silent && newsCollectStatus) {
      newsCollectStatus.textContent = '근거 검색어를 입력하세요.';
    }
    return { ok: false, snapshotId: '' };
  }

  if (!options.silent && newsCollectStatus) {
    newsCollectStatus.textContent = '뉴스를 수집하는 중입니다...';
  }
  if (newsCollectButton) {
    newsCollectButton.disabled = true;
  }

  const { ok, data } = await fetchJson('/api/snapshots/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      newsMode: 'split',
      sources: formData.getAll('sources').map(String),
    }),
  });

  if (newsCollectButton) {
    newsCollectButton.disabled = false;
  }

  if (!ok) {
    if (!options.silent && newsCollectStatus) {
      newsCollectStatus.textContent = data.error || '뉴스 수집에 실패했습니다.';
    }
    return { ok: false, snapshotId: '' };
  }

  const snapshotId = data.snapshotId || data.id || '';
  const count = data.articleCount ?? data.count ?? '?';

  if (!options.silent && newsCollectStatus) {
    newsCollectStatus.textContent = `근거 팩 ${snapshotId} 생성 완료 · ${count}건`;
  }

  if (snapshotList) {
    await refreshSnapshots();
  }
  if (options.autoSelect && snapshotId) {
    await useSnapshot(snapshotId);
  }

  return { ok: true, snapshotId };
}

function sanitizeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'debate';
}

function exportParticipantLabel(provider) {
  return provider === 'user' ? 'User' : provider;
}

function exportSpeakerLabel(message) {
  const label = String(message?.label || '').trim();
  const provider = String(message?.provider || '').trim();
  if (label && provider && label !== provider) {
    return `${label} (${provider})`;
  }
  return label || exportParticipantLabel(provider);
}

function buildSessionMarkdown(session, envelopes) {
  const events = (envelopes || []).map((envelope) => envelope.event);
  const roundFinishedEvents = events.filter((event) => event.type === 'round_finished');
  const roundStateEvents = events.filter((event) => event.type === 'round_state_ready');
  const synthesisEvent = [...events].reverse().find(
    (event) => event.type === 'synthesis_ready' && event.payload?.status === 'completed'
  );
  const errorEvents = events.filter((event) => event.type === 'error');
  const cancelledEvent = [...events].reverse().find((event) => event.type === 'cancelled');
  const workflowMeta = getWorkflowMeta(session?.workflowKind);

  const lines = [];
  lines.push(`# Debate: ${session?.question || 'Untitled'}`);
  lines.push('');
  lines.push(`- Session ID: \`${session?.sessionId || activeSessionId || 'unknown'}\``);
  lines.push(`- Status: \`${session?.status || 'unknown'}\``);
  if (session?.workflowKind) lines.push(`- Workflow: \`${workflowMeta.label}\``);
  if (session?.participants?.length) lines.push(`- Participants: \`${formatParticipantsInline(session.participants)}\``);
  if (session?.judge) lines.push(`- Judge: \`${session.judge}\``);
  if (session?.executionCwd) lines.push(`- Execution cwd: \`${session.executionCwd}\``);
  if (session?.evidence?.id) lines.push(`- Evidence Pack: \`${session.evidence.id}\` (${session.evidence.articleCount} articles)`);
  if (session?.ollamaModel) lines.push(`- Ollama Model: \`${session.ollamaModel}\``);
  if (session?.createdAt) lines.push(`- Created: ${formatDateTime(session.createdAt)}`);
  if (session?.updatedAt) lines.push(`- Updated: ${formatDateTime(session.updatedAt)}`);
  lines.push('');

  if (roundFinishedEvents.length > 0) {
    lines.push('## Debate Process');
    lines.push('');

    for (const roundEvent of roundFinishedEvents) {
      lines.push(`### Round ${roundEvent.payload.round}`);
      lines.push('');

      for (const message of roundEvent.payload.messages) {
        lines.push(`#### ${exportSpeakerLabel(message)} (${message.phase})`);
        lines.push('');
        lines.push(message.content || '');
        lines.push('');
      }

      const roundState = roundStateEvents.find((event) => event.payload.round === roundEvent.payload.round);
      if (roundState) {
        lines.push('#### Round State');
        lines.push('');
        lines.push(roundState.payload.summary || '');
        lines.push('');
        if (Array.isArray(roundState.payload.keyIssues) && roundState.payload.keyIssues.length > 0) {
          lines.push('Key issues:');
          roundState.payload.keyIssues.forEach((item) => lines.push(`- ${item}`));
          lines.push('');
        }
      }

      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push('## Debate Process');
    lines.push('');
    lines.push('_No completed round messages found._');
    lines.push('');
  }

  lines.push('## Final Conclusion');
  lines.push('');

  if (synthesisEvent?.payload?.content) {
    lines.push(synthesisEvent.payload.content);
  } else if (cancelledEvent) {
    lines.push(`Session cancelled (${cancelledEvent.payload.reason}).`);
  } else {
    lines.push('_Synthesis not available._');
  }
  lines.push('');

  if (errorEvents.length > 0 || cancelledEvent) {
    lines.push('## Runtime Notes');
    lines.push('');
    for (const errorEvent of errorEvents) {
      lines.push(`- Error [${errorEvent.payload.code}]: ${errorEvent.payload.message}`);
    }
    if (cancelledEvent) {
      lines.push(`- Cancelled: ${cancelledEvent.payload.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function bindAdvancedToggle(button, panel) {
  if (!button || !panel) return;

  const update = () => {
    const open = !panel.classList.contains('collapsed');
    button.textContent = open ? '고급 설정 닫기' : '고급 설정 보기';
  };

  update();
  button.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    update();
  });
}

async function fetchRuntimeDefaults() {
  const { ok, data } = await fetchJson('/api/runtime');
  if (!ok) return;

  defaultRuntimeCwd = String(data.cwd || '').trim();

  if (defaultRuntimeCwd && projectExecutionCwdInput && !projectExecutionCwdInput.value) {
    projectExecutionCwdInput.value = defaultRuntimeCwd;
  }

  if (defaultRuntimeCwd && projectRuntimeHint) {
    projectRuntimeHint.textContent = `현재 로컬 작업 디렉터리 기본값: ${defaultRuntimeCwd}`;
  }

  if (defaultRuntimeCwd && newsExecutionCwdInput) {
    newsExecutionCwdInput.placeholder = defaultRuntimeCwd;
  }
}

if (refreshButton) {
  refreshButton.addEventListener('click', async () => {
    cachedOllamaModels = [];
    const tasks = [refreshSessions(), refreshRoleTemplates(), refreshProviderOptions(), fetchRuntimeDefaults()];
    if (snapshotList) {
      tasks.push(refreshSnapshots());
    }
    await Promise.all(tasks);
    executeStatus.textContent = '세션, 역할 템플릿, provider, 근거 팩, 런타임 경로를 새로고침했습니다.';
  });
}

if (replayButton && replayInput) {
  replayButton.addEventListener('click', async () => {
    const sequence = Number(replayInput.value || '1');
    await replayEvents(sequence);
  });
}

if (projectForm) {
  projectForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    executeStatus.textContent = '프로젝트 개선 토론을 시작하는 중입니다...';

    const formData = new FormData(projectForm);
    const question = String(formData.get('question') || '').trim();
    const participantResult = resolveWorkflowParticipants('project');

    if (!question) {
      executeStatus.textContent = '개선 질문을 먼저 입력하세요.';
      return;
    }

    if (!participantResult.ok) {
      executeStatus.textContent = participantResult.error;
      return;
    }

    const participants = participantResult.participants;
    currentParticipants = normalizeParticipants(participants);
    renderParticipantLanes();

    totalRounds = toInt(formData.get('rounds'), 3);
    const timeoutSeconds = toInt(formData.get('timeoutSeconds'), 900);
    const judge = String(formData.get('judge') || 'claude');
    const executionCwd = String(formData.get('executionCwd') || '').trim();
    const noContext = formData.get('noContext') !== null;
    const filesInput = projectForm.querySelector('input[name="questionFiles"]');
    const { attachments, warnings } = await buildQuestionAttachments(filesInput?.files);

    const result = await executeRunDebate({
      command: 'run_debate',
      timeoutMs: timeoutSeconds * 1000,
      input: {
        question,
        rounds: totalRounds,
        judge,
        participants,
        noContext,
        executionCwd: executionCwd || undefined,
        attachments,
        workflowKind: 'project',
      },
    });

    if (result.ok && warnings.length > 0) {
      executeStatus.textContent += ` (첨부 경고: ${warnings.join(', ')})`;
    }
  });
}

if (newsCollectButton) {
  newsCollectButton.addEventListener('click', async () => {
    await collectSnapshotFromNewsForm({ autoSelect: true, silent: false });
  });
}

if (newsForm) {
  newsForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    executeStatus.textContent = '뉴스 토론을 시작하는 중입니다...';

    const formData = new FormData(newsForm);
    const rawQuestion = String(formData.get('question') || '').trim();
    const query = String(formData.get('query') || '').trim();
    const question = rawQuestion || (query ? `"${query}" 관련 최신 뉴스의 의미와 향후 영향을 토론해줘` : '');

    if (!question) {
      executeStatus.textContent = '뉴스 토론 질문이나 근거 탐색어를 입력하세요.';
      return;
    }

    if (!selectedSnapshotId) {
      const collected = await collectSnapshotFromNewsForm({ autoSelect: true, silent: false });
      if (!collected.ok) {
        executeStatus.textContent = '뉴스 토론을 시작하려면 먼저 근거 팩을 준비해야 합니다.';
        return;
      }
    }

    const participantResult = resolveWorkflowParticipants('news');
    if (!participantResult.ok) {
      executeStatus.textContent = participantResult.error;
      return;
    }

    const participants = participantResult.participants;
    currentParticipants = normalizeParticipants(participants);
    renderParticipantLanes();

    totalRounds = toInt(formData.get('rounds'), 3);
    const timeoutSeconds = toInt(formData.get('timeoutSeconds'), 900);
    const judge = String(formData.get('judge') || 'claude');
    const executionCwd = String(formData.get('executionCwd') || '').trim();
    const noContext = formData.get('noContext') !== null;
    const snapshotId = debateSnapshotInput?.value?.trim() || selectedSnapshotId || '';
    const ollamaModel = String(formData.get('ollamaModel') || '').trim();

    if (!snapshotId) {
      executeStatus.textContent = '선택된 뉴스 근거 팩이 없습니다.';
      return;
    }

    if ([...participants.map((participant) => participant.provider), judge].includes('ollama') && !ollamaModel) {
      executeStatus.textContent = '뉴스 토론에서 Ollama를 선택했다면 사용할 모델을 선택하세요.';
      newsOllamaModelSelect?.focus();
      return;
    }

    await executeRunDebate({
      command: 'run_debate',
      timeoutMs: timeoutSeconds * 1000,
      input: {
        question,
        rounds: totalRounds,
        judge,
        participants,
        noContext,
        executionCwd: executionCwd || undefined,
        snapshotId,
        workflowKind: 'news',
        ollamaModel: ollamaModel || undefined,
      },
    });
  });
}

if (stopSessionButton) {
  stopSessionButton.addEventListener('click', async () => {
    if (!activeSessionId) {
      executeStatus.textContent = '먼저 세션을 선택하세요.';
      return;
    }

    executeStatus.textContent = `${activeSessionId} 세션을 중지하는 중입니다...`;
    const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/stop`, { method: 'POST' });
    if (!ok) {
      executeStatus.textContent = data.error || '세션 중지에 실패했습니다.';
      return;
    }

    executeStatus.textContent = `${activeSessionId} 세션 중지를 요청했습니다.`;
    setConnState('idle');
    await refreshSessions();
  });
}

if (stopTeamButton) {
  stopTeamButton.addEventListener('click', async () => {
    executeStatus.textContent = '실행 중인 모든 세션을 중지하는 중입니다...';
    const { ok, data } = await fetchJson('/api/sessions/stop', { method: 'POST' });
    if (!ok) {
      executeStatus.textContent = data.error || '전체 세션 중지에 실패했습니다.';
      return;
    }

    executeStatus.textContent = `${data.stoppedSessions ?? 0}개의 세션에 중지 요청을 보냈습니다.`;
    setConnState('idle');
    await refreshSessions();
  });
}

if (exportMarkdownButton) {
  exportMarkdownButton.addEventListener('click', async () => {
    if (!activeSessionId) {
      executeStatus.textContent = '먼저 세션을 선택하세요.';
      return;
    }

    executeStatus.textContent = `${activeSessionId} 세션을 Markdown으로 내보내는 중입니다...`;
    const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=1`);
    if (!ok) {
      executeStatus.textContent = data.error || '세션 이벤트를 불러오지 못했습니다.';
      return;
    }

    const session = cachedSessions.find((item) => item.sessionId === activeSessionId);
    const markdown = buildSessionMarkdown(session, data.events || []);
    const filename = `${sanitizeFileName(session?.question || activeSessionId)}-${activeSessionId.slice(0, 8)}.md`;
    downloadTextFile(filename, markdown, 'text/markdown;charset=utf-8');
    executeStatus.textContent = `Markdown을 내보냈습니다: ${filename}`;
  });
}

if (useNewsQuestionButton && newsQuestionInput && newsQueryInput) {
  useNewsQuestionButton.addEventListener('click', () => {
    const question = String(newsQuestionInput.value || '').trim();
    if (!question) {
      newsCollectStatus.textContent = '먼저 뉴스 토론 질문을 입력하세요.';
      return;
    }

    newsQueryInput.value = question;
    newsCollectStatus.textContent = '뉴스 토론 질문을 근거 탐색어로 복사했습니다.';
  });
}

if (openEvidenceModalButton) {
  openEvidenceModalButton.addEventListener('click', () => {
    void viewCurrentEvidence();
  });
}

if (modalClose && articleModal) {
  modalClose.addEventListener('click', () => {
    articleModal.style.display = 'none';
  });
}

if (articleModal) {
  articleModal.addEventListener('click', (event) => {
    if (event.target === articleModal) {
      articleModal.style.display = 'none';
    }
  });
}

document.querySelectorAll('.template-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const template = chip.getAttribute('data-template') || '';
    const target = chip.getAttribute('data-template-target');

    if (target === 'news' && newsQuestionInput) {
      newsQuestionInput.value = template;
      newsQuestionInput.focus();
      return;
    }

    if (projectQuestionInput) {
      projectQuestionInput.value = template;
      projectQuestionInput.focus();
    }
  });
});

bindAdvancedToggle(projectAdvancedToggle, projectAdvancedFields);
bindAdvancedToggle(newsAdvancedToggle, newsAdvancedFields);

[
  ['project', projectTemplateSelect],
  ['news', newsTemplateSelect],
].forEach(([workflow, control]) => {
  control?.addEventListener('change', async () => {
    renderWorkflowTemplateEditor(workflow);
    if (workflow === 'news') {
      await syncNewsOllamaModelField();
    }
  });
});

['project', 'news'].forEach((workflow) => {
  const controls = getWorkflowControls(workflow);

  controls.participantMode?.querySelectorAll('[data-participant-mode]').forEach((button) => {
    button.addEventListener('click', async () => {
      const nextMode = button.getAttribute('data-participant-mode') === 'custom' ? 'custom' : 'template';
      const currentMode = getWorkflowMode(workflow);
      if (nextMode === currentMode) {
        return;
      }

      if (nextMode === 'custom' && (getWorkflowComposerState(workflow).customParticipants || []).length === 0) {
        seedCustomParticipantsFromTemplate(workflow);
      }

      setWorkflowMode(workflow, nextMode);
      renderWorkflowTemplateEditor(workflow);
      if (workflow === 'news') {
        await syncNewsOllamaModelField();
      }
    });
  });

  controls.customCountSelect?.addEventListener('change', async () => {
    setWorkflowCustomParticipantCount(workflow, controls.customCountSelect.value);
    renderWorkflowCustomParticipants(workflow);
    renderWorkflowComposer(workflow);
    if (workflow === 'news') {
      await syncNewsOllamaModelField();
    }
  });
});

newsJudgeSelect?.addEventListener('change', async () => {
  await syncNewsOllamaModelField();
});

roleConfigReloadButton?.addEventListener('click', async () => {
  if (roleConfigStatus) {
    roleConfigStatus.textContent = '역할 설정 YAML을 다시 불러오는 중입니다...';
  }
  await refreshRoleConfigEditor();
});

roleConfigSaveButton?.addEventListener('click', async () => {
  if (roleConfigStatus) {
    roleConfigStatus.textContent = '역할 설정 YAML을 저장하는 중입니다...';
  }
  await saveRoleConfigEditor();
});

roleConfigResetButton?.addEventListener('click', () => {
  if (!roleConfigEditor) return;
  roleConfigEditor.value = roleConfigDefaultRaw || roleConfigEditor.value;
  if (roleConfigStatus) {
    roleConfigStatus.textContent = '기본 템플릿 초안을 편집기에 복원했습니다. 저장하면 적용됩니다.';
  }
  if (roleConfigValidation) {
    roleConfigValidation.textContent = '기본 템플릿 초안이 편집기에 복원되었습니다. 저장 전 미리보기를 확인하세요.';
  }
});

async function initSettingsPage() {
  if (roleConfigStatus) {
    roleConfigStatus.textContent = '역할 설정을 불러오는 중입니다...';
  }
  await refreshRoleConfigEditor();
}

async function initWorkbenchPage() {
  const tasks = [refreshRoleTemplates(), refreshSessions(), refreshProviderOptions(), fetchRuntimeDefaults()];
  if (snapshotList) {
    tasks.push(refreshSnapshots());
  }
  await Promise.all(tasks);
}

async function init() {
  renderParticipantLanes();
  renderBubbles();
  renderTimeline();
  renderDecisionBoard();
  renderSynthesis();
  renderSelectedEvidence();
  renderEvidencePack();
  renderSessionBrief();

  if (pageWorkflow === 'settings') {
    await initSettingsPage();
    return;
  }

  await initWorkbenchPage();
  setInterval(async () => {
    await refreshProviderOptions();
  }, 5000);
}

init();
