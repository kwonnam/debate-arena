import {
  applySessionStatusPatch,
  deriveSessionStatusPatchFromEnvelope,
  isTerminalSessionStatus,
} from './session-status.js';

const sessionList = document.getElementById('session-list');
const streamBox = document.getElementById('stream');
const timelineBox = document.getElementById('timeline');
const synthesisBox = document.getElementById('synthesis');
const synthesisSection = document.getElementById('synthesis-section');
const followUpSection = document.getElementById('follow-up-section');
const followUpPanel = document.getElementById('follow-up-panel');
const followUpEmpty = document.getElementById('follow-up-empty');
const followUpComposer = document.getElementById('follow-up-composer');
const followUpConfigPreview = document.getElementById('follow-up-config-preview');
const followUpQuickStart = document.getElementById('follow-up-quickstart');
const followUpTopicInput = document.getElementById('follow-up-topic');
const followUpSuggestions = document.getElementById('follow-up-suggestions');
const followUpStatus = document.getElementById('follow-up-status');
const followUpStartButton = document.getElementById('follow-up-start');
const pageWorkflow = document.body.dataset.workflow || 'all';
const refreshButton = document.getElementById('refresh');
const replayButton = document.getElementById('replay');
const replayInput = document.getElementById('replay-seq');
const executeStatus = document.getElementById('execute-status');
const stopSessionButton = document.getElementById('stop-session');
const resumeSessionButton = document.getElementById('resume-session');
const continueSessionButton = document.getElementById('continue-session');
const stopTeamButton = document.getElementById('stop-team');
const exportMarkdownButton = document.getElementById('export-md');
const exportObsidianButton = document.getElementById('export-obsidian');
const exportSlidesButton = document.getElementById('export-slides');
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
const projectParticipantBuilder = document.getElementById('project-participant-builder');
const projectCustomCount = document.getElementById('project-custom-count');
const projectTemplateSelect = document.getElementById('project-template-select');
const projectTemplateSummary = document.getElementById('project-template-description');
const projectRoleSlots = document.getElementById('project-participant-config');
const projectCustomRoleSlots = document.getElementById('project-custom-participant-config');
const projectCustomSummary = document.getElementById('project-custom-summary');
const projectJudgeSelect = projectForm?.querySelector('select[name="judge"]');
const projectNoContextToggle = projectForm?.querySelector('input[name="noContext"]');
const projectOllamaModelGroup = document.getElementById('project-ollama-model-group');
const projectOllamaModelSelect = document.getElementById('project-ollama-model');
const projectIdeaIntentInput = document.getElementById('project-idea-intent');
const projectIdeaAudienceInput = document.getElementById('project-idea-audience');
const projectIdeaSeedInput = document.getElementById('project-idea-seed');
const projectIdeaProblemInput = document.getElementById('project-idea-problem');
const projectIdeaSuccessMetricInput = document.getElementById('project-idea-success-metric');
const projectIdeaConstraintsInput = document.getElementById('project-idea-constraints');
const projectIdeaPreview = document.getElementById('project-idea-preview');

const newsForm = document.getElementById('news-form');
const newsQuestionInput = newsForm?.querySelector('[name="question"]');
const newsEvidenceKindSelect = document.getElementById('news-evidence-kind');
const newsQueryInput = document.getElementById('news-query');
const newsQueryExpansionToggle = document.getElementById('news-query-expansion');
const newsQueryLanguageScopeSelect = document.getElementById('news-query-language-scope');
const newsOnlySourceInputs = Array.from(document.querySelectorAll('[data-news-only-source]'));
const newsTemplateChips = Array.from(document.querySelectorAll('.template-chip[data-template-target="news"]'));
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
const newsParticipantBuilder = document.getElementById('news-participant-builder');
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
const obsidianConfigPath = document.getElementById('obsidian-config-path');
const obsidianConfigMeta = document.getElementById('obsidian-config-meta');
const obsidianConfigStatus = document.getElementById('obsidian-config-status');
const obsidianVaultPathInput = document.getElementById('obsidian-vault-path');
const obsidianFolderGeneralInput = document.getElementById('obsidian-folder-general');
const obsidianFolderProjectInput = document.getElementById('obsidian-folder-project');
const obsidianFolderNewsInput = document.getElementById('obsidian-folder-news');
const obsidianOpenAfterSaveInput = document.getElementById('obsidian-open-after-save');
const obsidianConfigSaveButton = document.getElementById('obsidian-config-save');
const obsidianConfigReloadButton = document.getElementById('obsidian-config-reload');

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
let cachedObsidianConfig = null;
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
let followUpRequestInFlight = false;

const SYNTHESIS_PLACEHOLDER = 'Synthesizing...';
const MAX_FOLLOW_UP_SUGGESTIONS = 6;
const MAX_FILES = 6;
const MAX_TEXT_FILE_CHARS = 12_000;
const MAX_IMAGE_DATA_URL_CHARS = 180_000;
const MIN_PARTICIPANTS = 2;
const MAX_PARTICIPANTS = 6;
const CUSTOM_ROLE_VALUE = '__custom__';
const PARTICIPANT_SIDE_SEQUENCE = ['a', 'b', 'c'];

function normalizeEvidenceKind(value) {
  return value === 'web' ? 'web' : 'news';
}

function getEvidenceKindMeta(kind) {
  const normalized = normalizeEvidenceKind(kind);
  if (normalized === 'web') {
    return {
      kind: 'web',
      label: '웹',
      itemLabel: '웹 근거',
      itemListLabel: '웹 근거 목록',
      workflowLabel: '웹 근거 토론',
      collectingLabel: '웹 근거를 수집하는 중입니다...',
      collectFailedLabel: '웹 근거 수집에 실패했습니다.',
      selectedLabel: '선택된 웹 근거 팩이 없습니다.',
      connectedLabel: '웹 근거 팩',
      emptyListLabel: '표시할 웹 근거가 없습니다.',
      autoQuestionSuffix: '웹 자료의 의미와 향후 영향을 토론해줘',
      questionPlaceholder: '예: 이 웹 자료가 우리 제품과 시장에 어떤 영향을 미칠지 토론해줘',
      queryPlaceholder: '예: bun package manager roadmap 2026',
      idleStatusLabel: '검색어를 입력한 뒤 웹 근거 팩을 수집하세요.',
    };
  }

  return {
    kind: 'news',
    label: '뉴스',
    itemLabel: '뉴스 근거',
    itemListLabel: '기사 목록',
    workflowLabel: '뉴스 근거 토론',
    collectingLabel: '뉴스를 수집하는 중입니다...',
    collectFailedLabel: '뉴스 수집에 실패했습니다.',
    selectedLabel: '선택된 뉴스 근거 팩이 없습니다.',
    connectedLabel: '뉴스 근거 팩',
    emptyListLabel: '표시할 기사가 없습니다.',
    autoQuestionSuffix: '뉴스의 의미와 향후 영향을 토론해줘',
    questionPlaceholder: '예: 이 이슈가 우리 제품과 시장에 어떤 영향을 미칠지 토론해줘',
    queryPlaceholder: '예: AI regulation Europe 2026',
    idleStatusLabel: '검색어를 입력한 뒤 뉴스 근거 팩을 수집하세요.',
  };
}

function getSelectedNewsEvidenceKind() {
  return normalizeEvidenceKind(newsEvidenceKindSelect?.value);
}

function syncNewsEvidenceScopeUi() {
  const meta = getEvidenceKindMeta(getSelectedNewsEvidenceKind());
  const isNews = meta.kind === 'news';

  newsOnlySourceInputs.forEach((input) => {
    input.disabled = !isNews;
  });

  newsTemplateChips.forEach((chip) => {
    const labelAttr = meta.kind === 'web' ? 'data-web-label' : 'data-news-label';
    const templateAttr = meta.kind === 'web' ? 'data-web-template' : 'data-news-template';
    const nextLabel = chip.getAttribute(labelAttr) || chip.textContent || '';
    const nextTemplate = chip.getAttribute(templateAttr) || chip.getAttribute('data-template') || '';
    chip.textContent = nextLabel;
    chip.setAttribute('data-template', nextTemplate);
  });

  if (newsQuestionInput) {
    newsQuestionInput.placeholder = meta.questionPlaceholder;
  }

  if (newsQueryInput) {
    newsQueryInput.placeholder = meta.queryPlaceholder;
  }

  if (newsCollectStatus && !selectedSnapshotId) {
    newsCollectStatus.textContent = meta.idleStatusLabel;
  }
}

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
      modeSelect: newsForm?.querySelector('select[name="mode"]'),
      roundsInput: newsForm?.querySelector('input[name="rounds"]'),
      executionCwdInput: newsExecutionCwdInput,
      noContextToggle: newsForm?.querySelector('input[name="noContext"]'),
      ollamaModelSelect: newsOllamaModelSelect,
      snapshotInput: debateSnapshotInput,
      advancedToggle: newsAdvancedToggle,
      advancedFields: newsAdvancedFields,
      participantBuilder: newsParticipantBuilder,
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
    modeSelect: projectForm?.querySelector('select[name="mode"]'),
    roundsInput: projectForm?.querySelector('input[name="rounds"]'),
    executionCwdInput: projectExecutionCwdInput,
    noContextToggle: projectNoContextToggle,
    ollamaModelSelect: projectOllamaModelSelect,
    snapshotInput: null,
    advancedToggle: projectAdvancedToggle,
    advancedFields: projectAdvancedFields,
    participantBuilder: projectParticipantBuilder,
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

function sessionHasEvidence(session) {
  return Boolean(session?.evidence?.id);
}

function pageAllowsWorkflow(session) {
  const workflowKind = session?.workflowKind;
  if (pageWorkflow === 'news') {
    return sessionHasEvidence(session);
  }

  if (pageWorkflow === 'project') {
    return workflowKind === 'project' || (!sessionHasEvidence(session) && workflowKind !== 'news');
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

function getProjectIdeaIntentLabel(intent) {
  const labels = {
    propose: '새 아이디어 제안',
    refine: '아이디어 다듬기',
    mvp: 'MVP 범위 정리',
    validation: '가설/리스크 검증',
  };
  return labels[intent] || labels.refine;
}

function collectProjectIdeaStudioValues() {
  return {
    intent: String(projectIdeaIntentInput?.value || 'refine').trim() || 'refine',
    audience: String(projectIdeaAudienceInput?.value || '').trim(),
    seed: String(projectIdeaSeedInput?.value || '').trim(),
    problem: String(projectIdeaProblemInput?.value || '').trim(),
    successMetric: String(projectIdeaSuccessMetricInput?.value || '').trim(),
    constraints: String(projectIdeaConstraintsInput?.value || '').trim(),
  };
}

function hasProjectIdeaStudioContent(values = collectProjectIdeaStudioValues()) {
  return [values.audience, values.seed, values.problem, values.successMetric, values.constraints].some(Boolean);
}

function buildProjectIdeaQuestion(values = collectProjectIdeaStudioValues()) {
  const starter = values.seed
    ? `현재 아이디어 "${values.seed}"`
    : '아래 아이디어 브리프';
  const templates = {
    propose: `${starter}를 바탕으로 새로운 제품 또는 기능 아이디어를 2~3개 제안하고, 가장 유망한 방향의 핵심 가치와 초기 MVP를 정리해줘.`,
    refine: `${starter}를 바탕으로 현재 구상을 더 선명한 기획으로 다듬고, 대상 사용자, 차별점, 핵심 사용자 흐름을 정리해줘.`,
    mvp: `${starter}를 바탕으로 가장 작은 MVP 범위와 제외할 기능, 빠른 검증 실험을 정리해줘.`,
    validation: `${starter}를 바탕으로 핵심 가설, 가장 큰 리스크, 먼저 확인할 검증 질문을 우선순위와 함께 정리해줘.`,
  };
  return templates[values.intent] || templates.refine;
}

function buildProjectIdeaAttachment(values = collectProjectIdeaStudioValues()) {
  if (!hasProjectIdeaStudioContent(values)) {
    return { attachment: null, truncated: false };
  }

  const lines = [
    '# 아이디어 스튜디오 브리프',
    '',
    `- 요청 유형: ${getProjectIdeaIntentLabel(values.intent)}`,
  ];

  if (values.seed) lines.push(`- 현재 아이디어: ${values.seed}`);
  if (values.problem) lines.push(`- 해결하려는 문제: ${values.problem}`);
  if (values.audience) lines.push(`- 대상 사용자 / 팀: ${values.audience}`);
  if (values.successMetric) lines.push(`- 성공 기준: ${values.successMetric}`);
  if (values.constraints) lines.push(`- 제약 조건: ${values.constraints}`);

  lines.push(
    '',
    '원하는 정리 방식:',
    '- 가능한 방향 2~3개 또는 더 나은 대안',
    '- 가장 유망한 방향의 핵심 가치 제안',
    '- MVP 범위 또는 가장 먼저 검증할 실험',
    '- 버려도 되는 가정, 우선순위가 낮은 항목, 주요 리스크',
  );

  const rawContent = lines.join('\n');
  return {
    attachment: {
      name: 'idea-studio.txt',
      kind: 'text',
      mimeType: 'text/plain',
      content: rawContent.slice(0, MAX_TEXT_FILE_CHARS),
    },
    truncated: rawContent.length > MAX_TEXT_FILE_CHARS,
  };
}

function renderProjectIdeaPreview() {
  if (!projectIdeaPreview) return;

  const values = collectProjectIdeaStudioValues();
  if (!hasProjectIdeaStudioContent(values)) {
    projectIdeaPreview.className = 'idea-preview-card empty';
    projectIdeaPreview.innerHTML = `
      <strong>자동 질문 미리보기</strong>
      <p>기획 캔버스를 채우면 자동 생성되는 토론 질문이 여기에 표시됩니다.</p>
    `;
    return;
  }

  projectIdeaPreview.className = 'idea-preview-card';
  projectIdeaPreview.innerHTML = `
    <strong>자동 질문 미리보기</strong>
    <p>${escapeHtml(buildProjectIdeaQuestion(values))}</p>
  `;
}

function canProjectUseOllama() {
  return Boolean(projectNoContextToggle?.checked);
}

function isOllamaProviderValue(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized || normalized === 'both') {
    return false;
  }

  const option = [...cachedProviderOptions, ...cachedJudgeOptions]
    .find((entry) => String(entry.value || '').trim().toLowerCase() === normalized);

  if (option?.type === 'ollama-compat') {
    return true;
  }

  return normalized.startsWith('ollama');
}

function getWorkflowMeta(workflowKind, evidenceKind) {
  const normalizedEvidenceKind = evidenceKind === 'web'
    ? 'web'
    : evidenceKind === 'news'
      ? 'news'
      : undefined;
  if (normalizedEvidenceKind === 'web') {
    return { label: '웹 근거 토론', className: 'workflow-web' };
  }

  if (workflowKind === 'news' || normalizedEvidenceKind === 'news') {
    return { label: '뉴스 근거 토론', className: 'workflow-news' };
  }

  if (workflowKind === 'project') {
    return { label: '프로젝트·기획', className: 'workflow-project' };
  }

  return { label: '일반 토론', className: 'workflow-general' };
}

function getModeMeta(mode) {
  if (mode === 'plan') {
    return {
      label: 'Plan',
      title: 'Implementation Plan',
      processLabel: 'Planning Process',
      conclusionLabel: 'Agreed Plan',
      roundStateLabel: 'Planning State',
      openingLabel: 'Initial plan',
      rebuttalLabel: 'Review',
      filePrefix: 'plan',
      sessionWord: '계획',
    };
  }

  if (mode === 'discussion') {
    return {
      label: 'Discussion',
      title: 'Discussion',
      processLabel: 'Discussion Process',
      conclusionLabel: 'Discussion Memo',
      roundStateLabel: 'Discussion State',
      openingLabel: 'Initial contribution',
      rebuttalLabel: 'Follow-up',
      filePrefix: 'discussion',
      sessionWord: '토의',
    };
  }

  return {
    label: 'Debate',
    title: 'Debate',
    processLabel: 'Debate Process',
    conclusionLabel: 'Final Conclusion',
    roundStateLabel: 'Round State',
    openingLabel: 'Opening',
    rebuttalLabel: 'Rebuttal',
    filePrefix: 'debate',
    sessionWord: '토론',
  };
}

function formatPhaseLabel(phase, mode) {
  const modeMeta = getModeMeta(mode);
  return phase === 'opening' ? modeMeta.openingLabel : modeMeta.rebuttalLabel;
}

function statusToClass(status) {
  return String(status || '').toUpperCase();
}

function canResumeSession(session) {
  const status = String(session?.status || '').toUpperCase();
  return status === 'FAILED' || status === 'CANCELLED';
}

function canContinueSession(session) {
  const status = String(session?.status || '').toUpperCase();
  return status === 'COMPLETED';
}

function getFollowUpTopicPlaceholder() {
  if (activeSessionSummary?.workflowKind === 'project') {
    return '예: 이 결론을 실제 구현 우선순위와 검증 계획으로 바꾸려면 무엇부터 확인해야 할까?';
  }

  if (activeSessionSummary?.evidence?.kind === 'web') {
    return '예: 이 결론이 제품 방향과 기술 선택에 어떤 추가 검토를 요구하는가?';
  }

  return '예: 이 결론이 다음 분기 제품 전략이나 시장 대응에 어떤 추가 검토를 요구하는가?';
}

function getFollowUpTopicSuggestions() {
  const seen = new Set();
  const suggestions = [];
  const buckets = [
    ...(Array.isArray(latestRoundState?.nextFocus) ? latestRoundState.nextFocus : []),
    ...(Array.isArray(latestRoundState?.keyIssues) ? latestRoundState.keyIssues : []),
  ];

  for (const raw of buckets) {
    const value = String(raw || '').trim();
    const normalized = value.toLowerCase();
    if (!value || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    suggestions.push(value);
    if (suggestions.length >= MAX_FOLLOW_UP_SUGGESTIONS) {
      break;
    }
  }

  return suggestions;
}

function normalizeFollowUpTopics(rawValue) {
  return String(rawValue || '')
    .split('\n')
    .map((line) => line.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
}

function buildFollowUpQuestion(topicText) {
  const topics = normalizeFollowUpTopics(topicText);
  const followUpConfig = resolveFollowUpConfiguration();
  const sourceModeMeta = getModeMeta(activeSessionSummary?.mode);
  const targetModeMeta = getModeMeta(followUpConfig.ok ? followUpConfig.config.mode : activeSessionSummary?.mode);
  const sourceSessionWord = sourceModeMeta.sessionWord || '토론';
  const targetSessionWord = targetModeMeta.sessionWord || '토의';
  const isProjectFollowUp = (followUpConfig.ok ? followUpConfig.config.workflowKind : activeSessionSummary?.workflowKind) === 'project';
  const intro = isProjectFollowUp
    ? `이전 ${sourceSessionWord}에서 정리된 기획 문서와 결론을 바탕으로`
    : `이전 ${sourceSessionWord}의 결론을 바탕으로`;
  const closing = isProjectFollowUp
    ? '기존 기획과 연결되는 점, 달라지는 가정, 사용자 흐름, 정보 구조, 화면/API/도메인 설계, 구현 리스크와 검증 순서를 함께 정리해줘.'
    : '기존 결론과 연결되는 점, 달라지는 가정, 추가로 검증할 리스크와 다음 액션을 함께 정리해줘.';

  if (topics.length <= 1) {
    const singleTopic = topics[0] || String(topicText || '').trim();
    return `${intro} "${singleTopic}"를 새 주제로 삼아 후속 ${targetSessionWord}를 진행해줘. ${closing}`;
  }

  return [
    `${intro} 다음 주제들을 묶어 후속 ${targetSessionWord}를 진행해줘.`,
    '',
    ...topics.map((topic) => `- ${topic}`),
    '',
    closing,
  ].join('\n');
}

function getFollowUpWorkflow() {
  return pageWorkflow === 'news' ? 'news' : 'project';
}

function getFollowUpForm() {
  return getFollowUpWorkflow() === 'news' ? newsForm : projectForm;
}

function resolveFollowUpConfiguration() {
  const workflow = getFollowUpWorkflow();
  const controls = getWorkflowControls(workflow);
  const form = controls.form;

  if (!form) {
    return { ok: false, error: '후속 토의 설정을 불러오지 못했습니다.' };
  }

  const participantResult = resolveWorkflowParticipants(workflow);
  if (!participantResult.ok) {
    return participantResult;
  }

  const executionCwd = String(controls.executionCwdInput?.value || '').trim();
  const ollamaModel = String(controls.ollamaModelSelect?.value || '').trim();
  const config = {
    workflowKind: workflow,
    mode: String(controls.modeSelect?.value || activeSessionSummary?.mode || 'discussion'),
    rounds: toInt(controls.roundsInput?.value, activeSessionSummary?.rounds || 3),
    judge: String(controls.judgeSelect?.value || activeSessionSummary?.judge || 'claude'),
    participants: participantResult.participants,
    noContext: Boolean(controls.noContextToggle?.checked),
    executionCwd: executionCwd || undefined,
    snapshotId: workflow === 'news' ? (controls.snapshotInput?.value?.trim() || selectedSnapshotId || undefined) : undefined,
    ollamaModel: ollamaModel || undefined,
  };

  return { ok: true, config };
}

function renderFollowUpConfigurationPreview() {
  if (!followUpConfigPreview) return;

  if (!canContinueSession(activeSessionSummary)) {
    followUpConfigPreview.innerHTML = '';
    return;
  }

  const configResult = resolveFollowUpConfiguration();
  if (!configResult.ok) {
    followUpConfigPreview.innerHTML = `
      <strong>후속 토의 설정 확인</strong>
      <div class="participant-summary-grid">
        <div class="participant-summary-row">
          <span>현재 상단 설정</span>
          <p>${escapeHtml(configResult.error)}</p>
        </div>
        <div class="participant-summary-row">
          <span>적용 방식</span>
          <p>상단의 진행 방식, 참가자, Judge 설정이 이 후속 토의에 그대로 적용됩니다.</p>
        </div>
      </div>
    `;
    return;
  }

  const { config } = configResult;
  const modeMeta = getModeMeta(config.mode);
  const participantLabel = formatParticipantsInline(config.participants) || '선택된 참가자가 없습니다.';
  const contextSummary = config.workflowKind === 'news'
    ? (config.snapshotId
      ? `근거 팩 ${config.snapshotId}`
      : activeSessionSummary?.evidence?.id
        ? `이전 근거 팩 ${activeSessionSummary.evidence.id} 재사용`
        : '이전 근거를 재사용합니다.')
    : (config.noContext
      ? '프로젝트 자동 컨텍스트를 끄고 진행합니다.'
      : config.executionCwd
        ? `${shortPath(config.executionCwd)} 경로를 함께 읽습니다.`
        : activeSessionSummary?.executionCwd
          ? `${shortPath(activeSessionSummary.executionCwd)} 경로를 이어서 사용합니다.`
          : '이전 실행 경로를 이어서 사용합니다.');
  const workflowHint = config.workflowKind === 'project'
    ? '이전 결론은 기획 문서/브리프로 함께 주입되고, 아래 참가자 구성이 새 설계 토의를 이어받습니다.'
    : '이전 결론과 근거 문맥을 바탕으로, 아래 참가자 구성이 후속 토의를 새 시각으로 이어갑니다.';

  followUpConfigPreview.innerHTML = `
    <strong>후속 토의 실행 설정</strong>
    <div class="participant-summary-grid">
      <div class="participant-summary-row">
        <span>진행 방식</span>
        <p>${escapeHtml(modeMeta.label)} · Judge ${escapeHtml(config.judge)} · ${escapeHtml(config.rounds)} rounds</p>
      </div>
      <div class="participant-summary-row">
        <span>새 참가자 구성</span>
        <p>${escapeHtml(participantLabel)}</p>
      </div>
      <div class="participant-summary-row">
        <span>배경 문맥</span>
        <p>${escapeHtml(contextSummary)}</p>
      </div>
      <div class="participant-summary-row">
        <span>안내</span>
        <p>${escapeHtml(workflowHint)}</p>
      </div>
    </div>
  `;
}

function getFollowUpQuickStartPresets(workflow) {
  const templates = getWorkflowTemplates(workflow);
  if (templates.length === 0) {
    return [];
  }

  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const currentMode = String(getWorkflowControls(workflow).modeSelect?.value || 'discussion');

  if (workflow === 'project') {
    const preferred = [
      {
        templateId: 'project-ux-backend-qa',
        title: '프로그램 설계',
        description: '화면 흐름, API, 검증 계획까지 함께 다듬습니다.',
        mode: 'plan',
      },
      {
        templateId: 'project-ux-architecture',
        title: '구조 점검',
        description: '사용자 흐름과 시스템 경계를 빠르게 정리합니다.',
        mode: 'plan',
      },
      {
        templateId: 'project-product-discovery',
        title: '기획 재정리',
        description: '사용자 문제, MVP 범위, 검증 가설을 다시 세웁니다.',
        mode: 'discussion',
      },
    ].filter((item) => templateMap.has(item.templateId))
      .map((item) => ({
        ...item,
        template: templateMap.get(item.templateId),
      }));

    const includedIds = new Set(preferred.map((item) => item.templateId));
    const remainder = templates
      .filter((template) => !includedIds.has(template.id))
      .map((template) => ({
        templateId: template.id,
        title: template.label,
        description: template.description,
        mode: currentMode,
        template,
      }));

    return [...preferred, ...remainder];
  }

  return templates.map((template) => ({
    templateId: template.id,
    title: template.label,
    description: template.description,
    mode: currentMode,
    template,
  }));
}

async function applyFollowUpTemplatePreset(workflow, templateId, mode) {
  const controls = getWorkflowControls(workflow);
  const template = getWorkflowTemplates(workflow).find((item) => item.id === templateId);
  if (!template) {
    return;
  }

  if (controls.templateSelect) {
    controls.templateSelect.value = template.id;
  }
  if (controls.modeSelect && mode) {
    controls.modeSelect.value = mode;
  }
  if (getWorkflowMode(workflow) !== 'template') {
    setWorkflowMode(workflow, 'template');
  }
  if (template.recommendedJudge && controls.judgeSelect) {
    const judgeOptions = getWorkflowJudgeOptions(workflow);
    if (judgeOptions.some((option) => option.value === template.recommendedJudge && !option.disabled)) {
      controls.judgeSelect.value = template.recommendedJudge;
    }
  }

  renderWorkflowTemplateEditor(workflow);
  await syncWorkflowOllamaModelField(workflow);
  renderFollowUpComposer();
  updateFollowUpStatus(`${template.label} 구성을 적용했습니다. 새 주제를 입력해 후속 토의를 시작하세요.`);
  followUpTopicInput?.focus();
}

async function openFollowUpParticipantEditor(workflow) {
  const controls = getWorkflowControls(workflow);
  setAdvancedPanelOpen(controls.advancedToggle, controls.advancedFields, true);

  if (getWorkflowMode(workflow) !== 'custom') {
    if ((getWorkflowComposerState(workflow).customParticipants || []).length === 0) {
      seedCustomParticipantsFromTemplate(workflow);
    }
    setWorkflowMode(workflow, 'custom');
  }

  renderWorkflowTemplateEditor(workflow);
  await syncWorkflowOllamaModelField(workflow);
  renderFollowUpComposer();
  updateFollowUpStatus('Custom 참가자 편집으로 전환했습니다. 역할과 모델을 조정한 뒤 새 주제를 입력하세요.');

  const target = controls.participantBuilder || controls.customRoleSlots || controls.roleSlots;
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    const focusTarget = controls.customRoleSlots?.querySelector('select, input');
    if (focusTarget && 'focus' in focusTarget) {
      focusTarget.focus();
    }
  }, 140);
}

function renderFollowUpQuickStart() {
  if (!followUpQuickStart) return;

  if (!canContinueSession(activeSessionSummary)) {
    followUpQuickStart.innerHTML = '';
    followUpQuickStart.style.display = 'none';
    return;
  }

  const workflow = getFollowUpWorkflow();
  const controls = getWorkflowControls(workflow);
  const presets = getFollowUpQuickStartPresets(workflow);
  if (presets.length === 0) {
    followUpQuickStart.innerHTML = '';
    followUpQuickStart.style.display = 'none';
    return;
  }

  const currentTemplateId = controls.templateSelect?.value || getDefaultTemplateId(workflow);
  const currentMode = String(controls.modeSelect?.value || 'discussion');
  const participantMode = getWorkflowMode(workflow);
  const helperText = workflow === 'project'
    ? '후속 토의 카드 안에서 설계용 참가자 조합과 진행 방식을 바로 바꿀 수 있습니다.'
    : '후속 토의 카드 안에서 참가자 조합을 바로 바꿀 수 있습니다.';

  followUpQuickStart.style.display = 'flex';
  followUpQuickStart.innerHTML = `
    <div class="follow-up-quickstart-head">
      <strong>${workflow === 'project' ? '설계용 빠른 설정' : '참가자 빠른 설정'}</strong>
      <p>${escapeHtml(helperText)}</p>
    </div>
    <div class="follow-up-template-grid">
      ${presets.map((preset) => {
        const template = preset.template;
        const participantLabels = (template?.participants || [])
          .map((role) => `<span class="meta-badge">${escapeHtml(role.label)}</span>`)
          .join('');
        const isActive = participantMode === 'template'
          && currentTemplateId === preset.templateId
          && currentMode === preset.mode;
        const judgeValue = template?.recommendedJudge || String(controls.judgeSelect?.value || 'claude');
        return `
          <button
            class="follow-up-template-card ${isActive ? 'is-active' : ''}"
            type="button"
            data-follow-up-template="${escapeHtml(preset.templateId)}"
            data-follow-up-mode="${escapeHtml(preset.mode)}"
            aria-pressed="${String(isActive)}"
          >
            <span class="follow-up-template-kicker">${escapeHtml(preset.title)}</span>
            <strong>${escapeHtml(template?.label || preset.title)}</strong>
            <p>${escapeHtml(preset.description || template?.description || '')}</p>
            <div class="summary-chip-row">${participantLabels}</div>
            <span class="follow-up-template-meta">${escapeHtml(getModeMeta(preset.mode).label)} · Judge ${escapeHtml(judgeValue)}</span>
          </button>
        `;
      }).join('')}
    </div>
    <div class="execute-actions follow-up-shortcut-actions">
      <button class="button subtle" type="button" id="follow-up-customize-participants">참가자 직접 편집</button>
    </div>
  `;

  followUpQuickStart.querySelectorAll('[data-follow-up-template]').forEach((button) => {
    button.addEventListener('click', async () => {
      const templateId = button.getAttribute('data-follow-up-template') || '';
      const mode = button.getAttribute('data-follow-up-mode') || '';
      await applyFollowUpTemplatePreset(workflow, templateId, mode);
    });
  });

  followUpQuickStart.querySelector('#follow-up-customize-participants')?.addEventListener('click', async () => {
    await openFollowUpParticipantEditor(workflow);
  });
}

function getFollowUpStatusMessage() {
  if (!canContinueSession(activeSessionSummary)) {
    return 'COMPLETED 세션을 선택하면 결론을 바탕으로 새 주제를 이어갈 수 있습니다.';
  }

  if (followUpRequestInFlight) {
    return '이전 결론을 바탕으로 새 토의를 시작하는 중입니다...';
  }

  const configResult = resolveFollowUpConfiguration();
  if (!configResult.ok) {
    return configResult.error;
  }

  const topics = normalizeFollowUpTopics(followUpTopicInput?.value);
  if (topics.length > 0) {
    return `새 주제 ${topics.length}개가 준비되었습니다. 이전 결론과 함께 후속 토의로 전달됩니다.`;
  }

  if (getFollowUpTopicSuggestions().length > 0) {
    return '추천 주제를 눌러 추가하거나, 직접 새 주제를 한 줄씩 입력해 후속 토의를 시작하세요.';
  }

  if (!latestRoundState) {
    return '새 주제는 지금 바로 입력할 수 있고, 마지막 라운드를 불러오면 추천 주제도 함께 표시됩니다.';
  }

  return '결론에서 파생된 새 주제를 한 줄씩 입력하면 이전 합의와 쟁점을 이어받아 후속 토의를 시작합니다.';
}

function updateFollowUpStatus(message = getFollowUpStatusMessage()) {
  if (!followUpStatus) return;
  followUpStatus.textContent = message;
}

function addFollowUpTopic(topic) {
  if (!followUpTopicInput) return;

  const currentTopics = normalizeFollowUpTopics(followUpTopicInput.value);
  if (currentTopics.some((item) => item.toLowerCase() === String(topic || '').trim().toLowerCase())) {
    followUpTopicInput.focus();
    return;
  }

  const nextValue = currentTopics.length > 0
    ? `${followUpTopicInput.value.trim()}\n- ${topic}`
    : topic;

  followUpTopicInput.value = nextValue;
  updateFollowUpStatus();
  followUpTopicInput.focus();
}

function renderFollowUpComposer() {
  if (!followUpComposer || !followUpTopicInput || !followUpEmpty) return;

  const readyForFollowUp = canContinueSession(activeSessionSummary);
  const configResult = readyForFollowUp ? resolveFollowUpConfiguration() : null;

  followUpComposer.style.display = readyForFollowUp ? 'flex' : 'none';
  followUpEmpty.style.display = readyForFollowUp ? 'none' : 'block';

  if (!readyForFollowUp) {
    if (!activeSessionSummary) {
      followUpEmpty.innerHTML = `
        <strong>완료된 세션을 선택하세요.</strong>
        <p>결론이 있는 세션을 고르면 여기서 바로 새 주제를 추가할 수 있습니다.</p>
      `;
    } else {
      followUpEmpty.innerHTML = `
        <strong>아직 후속 토의를 시작할 수 없습니다.</strong>
        <p>현재 세션 상태가 <code>${escapeHtml(activeSessionSummary.status || 'UNKNOWN')}</code>입니다. 완료된 세션을 선택하면 이 카드에서 바로 새 주제를 추가할 수 있습니다.</p>
      `;
    }

    followUpTopicInput.value = '';
    followUpTopicInput.disabled = true;
    if (followUpStartButton) {
      followUpStartButton.disabled = true;
    }
    if (followUpSuggestions) {
      followUpSuggestions.innerHTML = '';
      followUpSuggestions.style.display = 'none';
    }
    if (followUpConfigPreview) {
      followUpConfigPreview.innerHTML = '';
    }
    if (followUpQuickStart) {
      followUpQuickStart.innerHTML = '';
      followUpQuickStart.style.display = 'none';
    }
    updateFollowUpStatus();
    return;
  }

  const modeMeta = getModeMeta(configResult?.ok ? configResult.config.mode : activeSessionSummary?.mode);
  const canStartFollowUp = !followUpRequestInFlight && Boolean(configResult?.ok);
  followUpTopicInput.disabled = followUpRequestInFlight;
  followUpTopicInput.placeholder = getFollowUpTopicPlaceholder();
  renderFollowUpConfigurationPreview();
  renderFollowUpQuickStart();

  if (followUpStartButton) {
    followUpStartButton.disabled = !canStartFollowUp;
    followUpStartButton.textContent = `새 ${modeMeta.sessionWord} 시작`;
  }

  const suggestions = getFollowUpTopicSuggestions();
  if (followUpSuggestions) {
    if (suggestions.length === 0) {
      followUpSuggestions.innerHTML = '';
      followUpSuggestions.style.display = 'none';
    } else {
      followUpSuggestions.style.display = 'flex';
      followUpSuggestions.innerHTML = suggestions
        .map((topic) => {
          const escapedTopic = escapeHtml(topic);
          return `<button class="chip-button follow-up-chip" type="button" data-follow-up-topic="${escapedTopic}">${escapedTopic}</button>`;
        })
        .join('');

      followUpSuggestions.querySelectorAll('[data-follow-up-topic]').forEach((button) => {
        button.addEventListener('click', () => {
          const topic = button.getAttribute('data-follow-up-topic') || '';
          addFollowUpTopic(topic);
        });
      });
    }
  }

  updateFollowUpStatus();
}

function focusFollowUpComposer() {
  renderFollowUpComposer();

  if (!followUpComposer || followUpComposer.style.display === 'none' || !followUpTopicInput) {
    return false;
  }

  (followUpSection || followUpPanel || followUpComposer)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.setTimeout(() => {
    followUpTopicInput.focus();
  }, 120);
  return true;
}

function getActiveTimeoutMs() {
  const form = pageWorkflow === 'news' ? newsForm : projectForm;
  const timeoutInput = form?.querySelector('input[name="timeoutSeconds"]');
  const seconds = Number(timeoutInput?.value || '1800');
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 1800 * 1000;
  }
  return Math.trunc(seconds) * 1000;
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
    renderFollowUpComposer();
    return;
  }

  synthesisSection.style.display = 'block';

  if (synthesisContent === SYNTHESIS_PLACEHOLDER) {
    synthesisBox.innerHTML = '<div class="markdown-body"><p><em>최종 결론을 정리하는 중입니다...</em></p></div>';
    renderFollowUpComposer();
    return;
  }

  synthesisBox.innerHTML = `<div class="markdown-body">${markdownToHtml(synthesisContent)}</div>`;
  renderFollowUpComposer();

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
  if (workflow === 'project' && !canProjectUseOllama()) {
    return cachedProviderOptions.filter((option) => !isOllamaProviderValue(option.value));
  }

  return cachedProviderOptions;
}

function getWorkflowJudgeOptions(workflow) {
  if (workflow === 'project' && !canProjectUseOllama()) {
    return cachedJudgeOptions.filter((option) => !isOllamaProviderValue(option.value));
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
      await syncWorkflowOllamaModelField(workflow);
      renderFollowUpComposer();
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
      await syncWorkflowOllamaModelField(workflow);
      renderFollowUpComposer();
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
      await syncWorkflowOllamaModelField(workflow);
      renderFollowUpComposer();
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
      renderFollowUpComposer();
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
          <h3>${workflow === 'project' ? '프로젝트·기획' : '근거 기반 토론'}</h3>
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

async function refreshObsidianConfigEditor() {
  const { ok, data } = await fetchJson('/api/obsidian/config');
  if (!ok) {
    if (obsidianConfigStatus) {
      obsidianConfigStatus.textContent = data.error || 'Obsidian 설정을 불러오지 못했습니다.';
    }
    return;
  }

  cachedObsidianConfig = data.config || null;
  if (obsidianConfigPath) {
    obsidianConfigPath.textContent = data.path || '';
  }
  if (obsidianConfigMeta) {
    obsidianConfigMeta.textContent = 'Vault 경로와 워크플로우별 기본 저장 폴더를 설정합니다.';
  }
  if (obsidianVaultPathInput) {
    obsidianVaultPathInput.value = data.config?.vaultPath || '';
  }
  if (obsidianFolderGeneralInput) {
    obsidianFolderGeneralInput.value = data.config?.folders?.general || '';
  }
  if (obsidianFolderProjectInput) {
    obsidianFolderProjectInput.value = data.config?.folders?.project || '';
  }
  if (obsidianFolderNewsInput) {
    obsidianFolderNewsInput.value = data.config?.folders?.news || '';
  }
  if (obsidianOpenAfterSaveInput) {
    obsidianOpenAfterSaveInput.checked = Boolean(data.config?.openAfterSave);
  }
  if (obsidianConfigStatus) {
    obsidianConfigStatus.textContent = data.config?.vaultPath
      ? `Vault 저장 활성화 · ${data.config.vaultPath}`
      : 'Vault 경로를 저장하면 `Obsidian 노트` 버튼이 Vault에 바로 기록합니다.';
  }
}

async function saveObsidianConfigEditor() {
  const { ok, data } = await fetchJson('/api/obsidian/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vaultPath: obsidianVaultPathInput?.value || '',
      folders: {
        general: obsidianFolderGeneralInput?.value || '',
        project: obsidianFolderProjectInput?.value || '',
        news: obsidianFolderNewsInput?.value || '',
      },
      openAfterSave: Boolean(obsidianOpenAfterSaveInput?.checked),
    }),
  });

  if (!ok) {
    if (obsidianConfigStatus) {
      obsidianConfigStatus.textContent = data.error || 'Obsidian 설정 저장에 실패했습니다.';
    }
    return;
  }

  cachedObsidianConfig = data.config || null;
  if (obsidianConfigStatus) {
    obsidianConfigStatus.textContent = data.config?.vaultPath
      ? `Obsidian 설정 저장 완료 · ${data.config.vaultPath}`
      : 'Obsidian 설정 저장 완료 · Vault 경로를 입력하면 직접 저장이 활성화됩니다.';
  }
  await refreshObsidianConfigEditor();
}

function openObsidianUrl(url) {
  if (!url) return;
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

async function saveSessionNoteToObsidianVault(filename, content, workflowKind) {
  return fetchJson('/api/obsidian/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename,
      content,
      workflowKind,
    }),
  });
}

function renderSessions(sessions) {
  if (!sessionList) return;

  const visibleSessions = (sessions || []).filter((session) => pageAllowsWorkflow(session));

  if (visibleSessions.length === 0) {
    sessionList.innerHTML = '<p class="session-meta">아직 생성된 세션이 없습니다.</p>';
    return;
  }

  sessionList.innerHTML = visibleSessions
    .map((session) => {
      const active = session.sessionId === activeSessionId ? 'active' : '';
      const evidenceMeta = getEvidenceKindMeta(session.evidence?.kind);
      const evidenceBadge = session.evidence
        ? `<span class="meta-badge">${escapeHtml(evidenceMeta.itemLabel)} ${escapeHtml(session.evidence.id)}</span>`
        : '';
      const workspaceBadge = session.executionCwd
        ? `<span class="meta-badge">${escapeHtml(shortPath(session.executionCwd))}</span>`
        : '';
      const ollamaModelBadge = session.ollamaModel
        ? `<span class="meta-badge">Ollama ${escapeHtml(session.ollamaModel)}</span>`
        : '';
      const followUpBadge = session.continuedFromSessionId
        ? `<span class="meta-badge">Follow-up</span>`
        : '';
      const workflowMeta = getWorkflowMeta(session.workflowKind, session.evidence?.kind);
      const modeMeta = getModeMeta(session.mode);
      const participantLabel = formatParticipantsInline(session.participants);

      return `
        <div class="session-item ${active}" data-session-id="${escapeHtml(session.sessionId)}">
          <div class="session-item-head">
            <div class="session-tags">
              <span class="status-chip ${statusToClass(session.status)}">${escapeHtml(session.status)}</span>
              <span class="meta-badge workflow-chip ${workflowMeta.className}">${escapeHtml(workflowMeta.label)}</span>
              <span class="meta-badge">${escapeHtml(modeMeta.label)}</span>
            </div>
            <span class="session-meta">${escapeHtml(formatTime(session.updatedAt))}</span>
          </div>
          <div class="session-question">${escapeHtml(session.question)}</div>
          <div class="session-tags">
            ${participantLabel ? `<span class="meta-badge">${escapeHtml(participantLabel)}</span>` : ''}
            ${evidenceBadge}
            ${workspaceBadge}
            ${ollamaModelBadge}
            ${followUpBadge}
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

  if (resumeSessionButton) {
    resumeSessionButton.disabled = !canResumeSession(activeSessionSummary);
  }
  if (continueSessionButton) {
    continueSessionButton.disabled = !canContinueSession(activeSessionSummary);
  }

  if (!activeSessionSummary) {
    sessionBrief.className = 'session-context';
    sessionBrief.innerHTML = `
      <div class="empty-state">
        <strong>선택된 세션이 없습니다.</strong>
        <p>프로젝트·기획 또는 근거 기반 토론을 시작하거나, 아래 세션을 선택하세요.</p>
      </div>
    `;
    return;
  }

  const evidence = activeSessionSummary.evidence;
  const workspace = activeSessionSummary.executionCwd;
  const workflowMeta = getWorkflowMeta(activeSessionSummary.workflowKind, evidence?.kind);
  const modeMeta = getModeMeta(activeSessionSummary.mode);
  const evidenceMeta = getEvidenceKindMeta(evidence?.kind);
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
        <span class="meta-badge">${escapeHtml(modeMeta.label)}</span>
        ${participantLabel ? `<span class="meta-badge">${escapeHtml(participantLabel)}</span>` : ''}
        ${activeSessionSummary.judge ? `<span class="meta-badge">Judge ${escapeHtml(activeSessionSummary.judge)}</span>` : ''}
        ${workspace ? `<span class="meta-badge">${escapeHtml(shortPath(workspace))}</span>` : ''}
        ${evidence ? `<span class="meta-badge">${escapeHtml(evidenceMeta.itemLabel)} ${escapeHtml(evidence.id)}</span>` : '<span class="meta-badge">근거 없음</span>'}
        ${activeSessionSummary.ollamaModel ? `<span class="meta-badge">Ollama ${escapeHtml(activeSessionSummary.ollamaModel)}</span>` : ''}
        ${activeSessionSummary.resumedFromSessionId ? `<span class="meta-badge">Resume ${escapeHtml(activeSessionSummary.resumeStage || '')}</span>` : ''}
        ${activeSessionSummary.continuedFromSessionId ? `<span class="meta-badge">Follow-up</span>` : ''}
      </div>
      <div class="session-description">
        ${workflowMeta.label} 흐름의 ${escapeHtml(modeMeta.sessionWord)} 세션입니다.
        ${workspace
          ? ` 실행 경로는 <code>${escapeHtml(workspace)}</code>입니다.`
          : ' 별도 실행 경로는 지정되지 않았습니다.'}
        ${evidence
          ? ` 연결된 ${escapeHtml(evidenceMeta.itemLabel)}은 "${escapeHtml(evidence.query)}" (${escapeHtml(evidence.articleCount)}건)입니다.`
          : ' 근거 팩은 연결되지 않았습니다.'}
        ${activeSessionSummary.resumedFromSessionId
          ? ` 이 세션은 <code>${escapeHtml(activeSessionSummary.resumedFromSessionId)}</code>에서 ${escapeHtml(activeSessionSummary.resumeStage || '중단 지점')}부터 재시작한 실행입니다.`
          : ''}
        ${activeSessionSummary.continuedFromSessionId
          ? ` 이 세션은 <code>${escapeHtml(activeSessionSummary.continuedFromSessionId)}</code>의 결론을 이어받아 시작한 후속 토론입니다.`
          : ''}
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
  const searchPlanBadges = getSearchPlanBadges(summary?.searchPlan);
  const evidenceMeta = getEvidenceKindMeta(summary?.kind);

  return `
    <div class="selected-evidence-title"><strong>${escapeHtml(title)}</strong></div>
    <div class="summary-chip-row">
      ${summary?.id ? `<span class="meta-badge">${escapeHtml(summary.id)}</span>` : ''}
      <span class="meta-badge">${escapeHtml(evidenceMeta.itemLabel)}</span>
      ${collectedAt ? `<span class="meta-badge">${escapeHtml(collectedAt)}</span>` : ''}
      ${articleCount !== null ? `<span class="meta-badge">${escapeHtml(articleCount)}건</span>` : ''}
      ${sourceCount ? `<span class="meta-badge">sources ${escapeHtml(sourceCount)}</span>` : ''}
      ${typeof summary?.excludedCount === 'number' ? `<span class="meta-badge">excluded ${escapeHtml(summary.excludedCount)}</span>` : ''}
      ${searchPlanBadges.map((badge) => `<span class="meta-badge">${escapeHtml(badge)}</span>`).join('')}
      ${topDomains.map((domain) => `<span class="meta-badge">${escapeHtml(domain)}</span>`).join('')}
    </div>
    ${buttons}
  `;
}

function renderSelectedEvidence() {
  if (!selectedEvidence) return;

  if (!selectedSnapshotId) {
    const evidenceMeta = getEvidenceKindMeta(getSelectedNewsEvidenceKind());
    selectedEvidence.className = 'selected-evidence-card empty';
    selectedEvidence.innerHTML = `<div class="selected-evidence-empty">${escapeHtml(evidenceMeta.selectedLabel)} ${escapeHtml(evidenceMeta.workflowLabel)} 시작 시 자동 수집하거나, 아래 라이브러리에서 선택할 수 있습니다.</div>`;
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
        <button class="button subtle mini-button" type="button" data-action="view-selected">근거 보기</button>
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
  const evidenceMeta = getEvidenceKindMeta(detail?.kind);
  const articles = Array.isArray(detail?.articles) ? detail.articles.slice(0, 5) : [];
  if (articles.length === 0) {
    return `<p class="session-meta">연결된 ${escapeHtml(evidenceMeta.itemListLabel)}을 아직 불러오지 못했습니다.</p>`;
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
      const searchPlanBadges = getSearchPlanBadges(snapshot.searchPlan);
      const evidenceMeta = getEvidenceKindMeta(snapshot.kind);

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
            <span class="meta-badge">${escapeHtml(evidenceMeta.itemLabel)}</span>
            <span class="meta-badge">${escapeHtml(snapshot.articleCount ?? 0)}건</span>
            <span class="meta-badge">sources ${escapeHtml(sourceCount)}</span>
            ${searchPlanBadges.map((badge) => `<span class="meta-badge">${escapeHtml(badge)}</span>`).join('')}
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
  const detail = await loadSnapshotDetail(snapshotId);
  if (newsEvidenceKindSelect && detail?.kind) {
    newsEvidenceKindSelect.value = normalizeEvidenceKind(detail.kind);
  }
  if (newsCollectStatus) {
    const evidenceMeta = getEvidenceKindMeta(detail?.kind);
    newsCollectStatus.textContent = `${evidenceMeta.connectedLabel} ${snapshotId}를 토론에 연결했습니다.`;
  }
  syncNewsEvidenceScopeUi();
  renderSnapshots(cachedSnapshots);
  renderSelectedEvidence();
  renderEvidencePack();
  renderFollowUpComposer();
}

function clearSelectedSnapshot() {
  selectedSnapshotId = null;
  if (debateSnapshotInput) {
    debateSnapshotInput.value = '';
  }
  if (newsCollectStatus) {
    const evidenceMeta = getEvidenceKindMeta(getSelectedNewsEvidenceKind());
    newsCollectStatus.textContent = `${evidenceMeta.connectedLabel} 연결을 해제했습니다.`;
  }
  syncNewsEvidenceScopeUi();
  renderSnapshots(cachedSnapshots);
  renderSelectedEvidence();
  renderEvidencePack();
  renderFollowUpComposer();
}

async function viewSnapshot(snapshotId) {
  if (!modalTitle || !articleModal || !modalBody) return;

  const detail = await loadSnapshotDetail(snapshotId);
  const evidenceMeta = getEvidenceKindMeta(detail?.kind);

  modalTitle.textContent = `${evidenceMeta.itemListLabel} · ${snapshotId}`;
  articleModal.style.display = 'flex';

  if (!detail || !Array.isArray(detail.articles) || detail.articles.length === 0) {
    modalBody.innerHTML = `<p class="session-meta">${escapeHtml(evidenceMeta.emptyListLabel)}</p>`;
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
    executeStatus.textContent = '먼저 근거 팩을 선택하거나, 근거가 연결된 세션을 여세요.';
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
      synthesisContent = SYNTHESIS_PLACEHOLDER;
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

  const statusPatch = deriveSessionStatusPatchFromEnvelope(envelope);
  if (statusPatch) {
    cachedSessions = applySessionStatusPatch(cachedSessions, statusPatch);
    if (activeSessionSummary?.sessionId === statusPatch.sessionId) {
      activeSessionSummary = {
        ...activeSessionSummary,
        status: statusPatch.status,
        updatedAt: Math.max(Number(activeSessionSummary.updatedAt) || 0, Number(statusPatch.updatedAt) || 0),
      };
    }
    renderSessions(cachedSessions);
    renderSessionBrief();
    renderFollowUpComposer();
    if (isTerminalSessionStatus(statusPatch.status) && activeSessionId === statusPatch.sessionId) {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearTimeout(stalledTimer);
      stalledTimer = null;
      setConnState('idle');
      window.setTimeout(() => {
        void refreshSessions();
      }, 150);
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
  followUpRequestInFlight = false;
  if (followUpTopicInput) {
    followUpTopicInput.value = '';
  }
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
    (session) => session.sessionId === sessionId && pageAllowsWorkflow(session)
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
  renderFollowUpComposer();
  await syncDisplayedEvidence();
  await replayEvents(1);
  connectStream(sessionId);
}

async function refreshSessions() {
  const { ok, data } = await fetchJson('/api/sessions');
  if (!ok) return;

  cachedSessions = data.sessions || [];
  activeSessionSummary = cachedSessions.find(
    (session) => session.sessionId === activeSessionId && pageAllowsWorkflow(session)
  ) || null;
  renderSessions(cachedSessions);
  renderSessionBrief();
  renderFollowUpComposer();
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

function getWorkflowOllamaControls(workflow) {
  if (workflow === 'project') {
    return {
      group: projectOllamaModelGroup,
      select: projectOllamaModelSelect,
      errorStatus: executeStatus,
    };
  }

  return {
    group: newsOllamaModelGroup,
    select: newsOllamaModelSelect,
    errorStatus: newsCollectStatus,
  };
}

function shouldShowWorkflowOllamaModel(workflow) {
  if (workflow === 'project' && !canProjectUseOllama()) {
    return false;
  }

  const roleValues = getConfiguredWorkflowProviders(workflow);
  const judgeValue = workflow === 'project' ? projectJudgeSelect?.value : newsJudgeSelect?.value;
  return [...roleValues, judgeValue].some((value) => isOllamaProviderValue(value));
}

function renderOllamaModelOptions(select, models, preferredValue = '') {
  if (!select) return;

  const options = Array.isArray(models) ? models : [];
  const previous = preferredValue || select.value;

  if (options.length === 0) {
    select.innerHTML = '<option value="">사용 가능한 모델이 없습니다</option>';
    select.disabled = true;
    return;
  }

  select.innerHTML = [
    '<option value="">모델을 선택하세요</option>',
    ...options.map((model) => `<option value="${escapeHtml(model.id)}">${escapeHtml(model.name || model.id)}</option>`),
  ].join('');
  select.disabled = false;

  if (previous && options.some((model) => model.id === previous)) {
    select.value = previous;
  }
}

async function refreshOllamaModels() {
  const modelSelects = [projectOllamaModelSelect, newsOllamaModelSelect].filter(Boolean);
  if (modelSelects.length === 0) return;

  const previousValues = new Map();
  modelSelects.forEach((select) => {
    previousValues.set(select, select.value);
    select.disabled = true;
    select.innerHTML = '<option value="">모델을 불러오는 중입니다...</option>';
  });

  const { ok, data } = await fetchJson('/api/providers/ollama/models');
  if (!ok) {
    cachedOllamaModels = [];
    modelSelects.forEach((select) => {
      select.innerHTML = '<option value="">모델 목록을 불러오지 못했습니다</option>';
      select.disabled = true;
    });
    const message = data.error || 'Ollama 모델 목록을 불러오지 못했습니다.';
    if (newsCollectStatus && pageWorkflow === 'news') {
      newsCollectStatus.textContent = message;
    } else if (executeStatus && pageWorkflow === 'project') {
      executeStatus.textContent = message;
    }
    return;
  }

  cachedOllamaModels = data.models || [];
  modelSelects.forEach((select) => {
    renderOllamaModelOptions(select, cachedOllamaModels, previousValues.get(select) || '');
  });
}

async function syncWorkflowOllamaModelField(workflow) {
  const { group, select } = getWorkflowOllamaControls(workflow);
  if (!group) return;

  const visible = shouldShowWorkflowOllamaModel(workflow);
  group.classList.toggle('collapsed', !visible);

  if (!visible && select) {
    select.value = '';
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
    type: provider.type,
  }));

  const judgeProviderNames = (data.judgeOptions || []).filter((value) => value !== 'both');
  const judgeProviderOptions = judgeProviderNames.length > 0
    ? judgeProviderNames.map((name) => {
        const match = cachedProviderOptions.find((option) => option.value === name);
        return match || { value: name, label: name, disabled: false, title: '', type: 'legacy' };
      })
    : cachedProviderOptions;

  cachedJudgeOptions = [
    ...judgeProviderOptions,
    { value: 'both', label: 'both', disabled: false, title: 'Prefer Claude as synthesizer', type: 'legacy' },
  ];
  setSelectOptions(projectJudgeSelect, getWorkflowJudgeOptions('project'), 'claude');
  setSelectOptions(newsJudgeSelect, getWorkflowJudgeOptions('news'), 'claude');
  renderAllWorkflowTemplateEditors();
  await syncWorkflowOllamaModelField('project');
  await syncWorkflowOllamaModelField('news');
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
  const evidenceKind = normalizeEvidenceKind(formData.get('evidenceKind'));
  const evidenceMeta = getEvidenceKindMeta(evidenceKind);
  const query = String(formData.get('query') || '').trim();
  const queryTransformMode = formData.get('queryTransformEnabled') !== null ? 'expand' : 'off';
  const queryLanguageScope = queryTransformMode === 'expand'
    ? String(formData.get('queryLanguageScope') || 'both')
    : 'input';

  if (!query) {
    if (!options.silent && newsCollectStatus) {
      newsCollectStatus.textContent = '근거 검색어를 입력하세요.';
    }
    return { ok: false, snapshotId: '' };
  }

  if (!options.silent && newsCollectStatus) {
    newsCollectStatus.textContent = evidenceMeta.collectingLabel;
  }
  if (newsCollectButton) {
    newsCollectButton.disabled = true;
  }

  const { ok, data } = await fetchJson('/api/snapshots/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      kind: evidenceKind,
      newsMode: 'split',
      sources: formData.getAll('sources').map(String),
      queryTransformMode,
      queryLanguageScope,
    }),
  });

  if (newsCollectButton) {
    newsCollectButton.disabled = false;
  }

  if (!ok) {
    if (!options.silent && newsCollectStatus) {
      newsCollectStatus.textContent = data.error || evidenceMeta.collectFailedLabel;
    }
    return { ok: false, snapshotId: '' };
  }

  const snapshotId = data.snapshotId || data.id || '';
  const count = data.articleCount ?? data.count ?? '?';
  const queryTransformSummary = getSearchPlanBadges(data.searchPlan).join(' · ');

  if (!options.silent && newsCollectStatus) {
    newsCollectStatus.textContent = `${evidenceMeta.connectedLabel} ${snapshotId} 생성 완료 · ${count}건${queryTransformSummary ? ` · ${queryTransformSummary}` : ''}`;
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

function getSearchPlanBadges(searchPlan) {
  if (!searchPlan || !Array.isArray(searchPlan.queries) || searchPlan.queries.length === 0) {
    return [];
  }

  const badges = [];
  if (searchPlan.llmApplied) {
    badges.push('LLM');
  }

  const languages = [...new Set(
    searchPlan.queries
      .map((query) => String(query?.language || '').trim().toUpperCase())
      .filter(Boolean)
  )];

  if (languages.length > 0) {
    badges.push(languages.join('/'));
  }

  return badges;
}

function syncNewsQueryTransformFields() {
  if (!newsQueryExpansionToggle || !newsQueryLanguageScopeSelect) return;
  newsQueryLanguageScopeSelect.disabled = !newsQueryExpansionToggle.checked;
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

function collectSessionExportData(session, envelopes) {
  const events = (envelopes || []).map((envelope) => envelope.event);
  return {
    events,
    roundFinishedEvents: events.filter((event) => event.type === 'round_finished'),
    roundStateEvents: events.filter((event) => event.type === 'round_state_ready'),
    synthesisEvent: [...events].reverse().find(
      (event) => event.type === 'synthesis_ready' && event.payload?.status === 'completed'
    ),
    errorEvents: events.filter((event) => event.type === 'error'),
    cancelledEvent: [...events].reverse().find((event) => event.type === 'cancelled'),
    workflowMeta: getWorkflowMeta(session?.workflowKind, session?.evidence?.kind),
    modeMeta: getModeMeta(session?.mode),
  };
}

function uniqueRoundStateItems(roundStateEvents, key) {
  const seen = new Set();
  const items = [];

  for (const event of roundStateEvents || []) {
    const values = Array.isArray(event?.payload?.[key]) ? event.payload[key] : [];
    for (const value of values) {
      const normalized = String(value || '').trim();
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      items.push(normalized);
    }
  }

  return items;
}

function yamlQuote(value) {
  return `"${String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')}"`;
}

function pushQuotedBlock(lines, content, prefix = '> ') {
  const normalized = String(content || '').trim();
  if (!normalized) return;
  normalized.split('\n').forEach((line) => {
    lines.push(`${prefix}${line}`);
  });
}

function buildSessionMarkdown(session, envelopes) {
  const {
    roundFinishedEvents,
    roundStateEvents,
    synthesisEvent,
    errorEvents,
    cancelledEvent,
    workflowMeta,
    modeMeta,
  } = collectSessionExportData(session, envelopes);

  const lines = [];
  lines.push(`# ${modeMeta.title}: ${session?.question || 'Untitled'}`);
  lines.push('');
  lines.push(`- Session ID: \`${session?.sessionId || activeSessionId || 'unknown'}\``);
  lines.push(`- Status: \`${session?.status || 'unknown'}\``);
  lines.push(`- Mode: \`${modeMeta.label}\``);
  if (session?.workflowKind) lines.push(`- Workflow: \`${workflowMeta.label}\``);
  if (session?.participants?.length) lines.push(`- Participants: \`${formatParticipantsInline(session.participants)}\``);
  if (session?.judge) lines.push(`- Judge: \`${session.judge}\``);
  if (session?.executionCwd) lines.push(`- Execution cwd: \`${session.executionCwd}\``);
  if (session?.evidence?.id) {
    const evidenceMeta = getEvidenceKindMeta(session.evidence.kind);
    lines.push(`- Evidence Pack: \`${session.evidence.id}\` (${evidenceMeta.itemLabel}, ${session.evidence.articleCount} entries)`);
  }
  if (session?.ollamaModel) lines.push(`- Ollama Model: \`${session.ollamaModel}\``);
  if (session?.createdAt) lines.push(`- Created: ${formatDateTime(session.createdAt)}`);
  if (session?.updatedAt) lines.push(`- Updated: ${formatDateTime(session.updatedAt)}`);
  lines.push('');

  if (roundFinishedEvents.length > 0) {
    lines.push(`## ${modeMeta.processLabel}`);
    lines.push('');

    for (const roundEvent of roundFinishedEvents) {
      lines.push(`### Round ${roundEvent.payload.round}`);
      lines.push('');

      for (const message of roundEvent.payload.messages) {
        lines.push(`#### ${exportSpeakerLabel(message)} (${formatPhaseLabel(message.phase, session?.mode)})`);
        lines.push('');
        lines.push(message.content || '');
        lines.push('');
      }

      const roundState = roundStateEvents.find((event) => event.payload.round === roundEvent.payload.round);
      if (roundState) {
        lines.push(`#### ${modeMeta.roundStateLabel}`);
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
    lines.push(`## ${modeMeta.processLabel}`);
    lines.push('');
    lines.push(`_No completed ${modeMeta.sessionWord} round messages found._`);
    lines.push('');
  }

  lines.push(`## ${modeMeta.conclusionLabel}`);
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

function buildSessionObsidianNote(session, envelopes) {
  const {
    roundFinishedEvents,
    roundStateEvents,
    synthesisEvent,
    errorEvents,
    cancelledEvent,
    workflowMeta,
    modeMeta,
  } = collectSessionExportData(session, envelopes);
  const evidenceMeta = session?.evidence ? getEvidenceKindMeta(session.evidence.kind) : null;
  const keyIssues = uniqueRoundStateItems(roundStateEvents, 'keyIssues');
  const agreements = uniqueRoundStateItems(roundStateEvents, 'agreements');
  const nextFocus = uniqueRoundStateItems(roundStateEvents, 'nextFocus');
  const summaryContent = synthesisEvent?.payload?.content
    || (cancelledEvent ? `Session cancelled (${cancelledEvent.payload.reason}).` : '최종 정리 내용이 아직 없습니다.');

  const lines = [];
  lines.push('---');
  lines.push(`title: ${yamlQuote(`${workflowMeta.label} - ${session?.question || 'Untitled'}`)}`);
  lines.push(`session_id: ${yamlQuote(session?.sessionId || activeSessionId || 'unknown')}`);
  lines.push(`status: ${yamlQuote(session?.status || 'unknown')}`);
  lines.push(`workflow: ${yamlQuote(workflowMeta.label)}`);
  lines.push(`mode: ${yamlQuote(modeMeta.label)}`);
  if (session?.judge) lines.push(`judge: ${yamlQuote(session.judge)}`);
  if (session?.executionCwd) lines.push(`execution_cwd: ${yamlQuote(session.executionCwd)}`);
  if (session?.createdAt) lines.push(`created_at: ${yamlQuote(new Date(session.createdAt).toISOString())}`);
  if (session?.updatedAt) lines.push(`updated_at: ${yamlQuote(new Date(session.updatedAt).toISOString())}`);
  if (session?.evidence?.id) lines.push(`evidence_pack: ${yamlQuote(session.evidence.id)}`);
  lines.push('participants:');
  (session?.participants || []).forEach((participant) => {
    lines.push(`  - ${yamlQuote(`${participant.label} (${participant.provider})`)}`);
  });
  lines.push('tags:');
  lines.push('  - "debate-arena"');
  lines.push(`  - ${yamlQuote(modeMeta.filePrefix)}`);
  lines.push(`  - ${yamlQuote(String(session?.workflowKind || 'general'))}`);
  if (session?.evidence?.kind) {
    lines.push(`  - ${yamlQuote(session.evidence.kind)}`);
  }
  lines.push('---');
  lines.push('');
  lines.push(`# ${session?.question || 'Untitled'}`);
  lines.push('');
  lines.push('> [!summary] Session Summary');
  pushQuotedBlock(lines, summaryContent);
  lines.push('');

  lines.push('## Context');
  lines.push('');
  lines.push(`- Workflow: ${workflowMeta.label}`);
  lines.push(`- Mode: ${modeMeta.label}`);
  if (session?.participants?.length) lines.push(`- Participants: ${formatParticipantsInline(session.participants)}`);
  if (session?.judge) lines.push(`- Judge: ${session.judge}`);
  if (session?.executionCwd) lines.push(`- Execution Cwd: \`${session.executionCwd}\``);
  if (session?.evidence?.id) {
    lines.push(`- Evidence Pack: ${session.evidence.id} (${evidenceMeta?.itemLabel || '근거'}, ${session.evidence.articleCount} entries)`);
    lines.push(`- Evidence Query: ${session.evidence.query}`);
  }
  lines.push('');

  lines.push('## Shared Agreements');
  lines.push('');
  if (agreements.length > 0) {
    agreements.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('- 아직 명시적으로 합의된 내용이 없습니다.');
  }
  lines.push('');

  lines.push('## Open Questions');
  lines.push('');
  if (keyIssues.length > 0) {
    keyIssues.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('- 추가 확인이 필요한 쟁점이 아직 정리되지 않았습니다.');
  }
  lines.push('');

  lines.push('## Next Actions');
  lines.push('');
  if (nextFocus.length > 0) {
    nextFocus.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('- 후속 액션이 아직 정리되지 않았습니다.');
  }
  lines.push('');

  lines.push('## Round Notes');
  lines.push('');
  if (roundFinishedEvents.length === 0) {
    lines.push('- 완료된 라운드가 없습니다.');
    lines.push('');
  } else {
    for (const roundEvent of roundFinishedEvents) {
      const roundState = roundStateEvents.find((event) => event.payload.round === roundEvent.payload.round);
      lines.push(`### Round ${roundEvent.payload.round}`);
      lines.push('');
      if (roundState?.payload?.summary) {
        lines.push(roundState.payload.summary);
        lines.push('');
      }
      if (Array.isArray(roundState?.payload?.keyIssues) && roundState.payload.keyIssues.length > 0) {
        lines.push('Key issues:');
        roundState.payload.keyIssues.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      }
      if (Array.isArray(roundState?.payload?.agreements) && roundState.payload.agreements.length > 0) {
        lines.push('Agreements:');
        roundState.payload.agreements.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      }
      if (Array.isArray(roundState?.payload?.nextFocus) && roundState.payload.nextFocus.length > 0) {
        lines.push('Next focus:');
        roundState.payload.nextFocus.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      }
    }
  }

  if (errorEvents.length > 0 || cancelledEvent) {
    lines.push('## Runtime Notes');
    lines.push('');
    errorEvents.forEach((event) => lines.push(`- Error [${event.payload.code}]: ${event.payload.message}`));
    if (cancelledEvent) {
      lines.push(`- Cancelled: ${cancelledEvent.payload.reason}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildSessionSlidesOutline(session, envelopes) {
  const {
    roundStateEvents,
    synthesisEvent,
    cancelledEvent,
    workflowMeta,
    modeMeta,
  } = collectSessionExportData(session, envelopes);
  const evidenceMeta = session?.evidence ? getEvidenceKindMeta(session.evidence.kind) : null;
  const keyIssues = uniqueRoundStateItems(roundStateEvents, 'keyIssues').slice(0, 6);
  const agreements = uniqueRoundStateItems(roundStateEvents, 'agreements').slice(0, 6);
  const nextFocus = uniqueRoundStateItems(roundStateEvents, 'nextFocus').slice(0, 6);
  const latestState = roundStateEvents.length > 0 ? roundStateEvents[roundStateEvents.length - 1].payload : null;
  const conclusion = synthesisEvent?.payload?.content
    || (cancelledEvent ? `Session cancelled (${cancelledEvent.payload.reason}).` : '최종 결론이 아직 없습니다.');

  const lines = [];
  lines.push(`# Slide Outline: ${session?.question || 'Untitled'}`);
  lines.push('');
  lines.push('## Slide 1 - Problem');
  lines.push(`- Question: ${session?.question || 'Untitled'}`);
  lines.push(`- Workflow: ${workflowMeta.label}`);
  lines.push(`- Mode: ${modeMeta.label}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Slide 2 - Context');
  if (session?.participants?.length) lines.push(`- Participants: ${formatParticipantsInline(session.participants)}`);
  if (session?.judge) lines.push(`- Judge: ${session.judge}`);
  if (session?.executionCwd) lines.push(`- Execution cwd: ${session.executionCwd}`);
  if (session?.evidence?.id) {
    lines.push(`- Evidence pack: ${session.evidence.id} (${evidenceMeta?.itemLabel || '근거'}, ${session.evidence.articleCount} entries)`);
    lines.push(`- Evidence query: ${session.evidence.query}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Slide 3 - Shared Signals');
  if (agreements.length > 0) {
    agreements.forEach((item) => lines.push(`- Agreement: ${item}`));
  }
  if (keyIssues.length > 0) {
    keyIssues.forEach((item) => lines.push(`- Trade-off: ${item}`));
  }
  if (agreements.length === 0 && keyIssues.length === 0) {
    lines.push(`- ${latestState?.summary || '정리된 핵심 신호가 아직 없습니다.'}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Slide 4 - Recommendation');
  lines.push(conclusion);
  lines.push('');
  lines.push('---');
  lines.push('');

  lines.push('## Slide 5 - Next Steps');
  if (nextFocus.length > 0) {
    nextFocus.forEach((item) => lines.push(`- ${item}`));
  } else {
    lines.push('- 후속 액션을 추가 정리해야 합니다.');
  }
  lines.push('');

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

function setAdvancedPanelOpen(button, panel, open) {
  if (!button || !panel) return;
  panel.classList.toggle('collapsed', !open);
  button.textContent = open ? '고급 설정 닫기' : '고급 설정 보기';
}

function bindAdvancedToggle(button, panel) {
  if (!button || !panel) return;

  setAdvancedPanelOpen(button, panel, !panel.classList.contains('collapsed'));
  button.addEventListener('click', () => {
    setAdvancedPanelOpen(button, panel, panel.classList.contains('collapsed'));
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

    const formData = new FormData(projectForm);
    const question = String(formData.get('question') || '').trim();
    const mode = String(formData.get('mode') || 'discussion');
    const modeMeta = getModeMeta(mode);
    executeStatus.textContent = `프로젝트·기획 ${modeMeta.sessionWord}를 시작하는 중입니다...`;
    const participantResult = resolveWorkflowParticipants('project');
    const ideaStudioValues = collectProjectIdeaStudioValues();
    const hasIdeaStudio = hasProjectIdeaStudioContent(ideaStudioValues);
    const finalQuestion = question || (hasIdeaStudio ? buildProjectIdeaQuestion(ideaStudioValues) : '');

    if (!finalQuestion) {
      executeStatus.textContent = '질문을 입력하거나 기획 캔버스를 먼저 채워주세요.';
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
    const ollamaModel = String(formData.get('ollamaModel') || '').trim();
    const filesInput = projectForm.querySelector('input[name="questionFiles"]');
    const { attachments, warnings } = await buildQuestionAttachments(filesInput?.files);
    const { attachment: ideaAttachment, truncated: ideaAttachmentTruncated } = buildProjectIdeaAttachment(ideaStudioValues);
    if (ideaAttachment) {
      attachments.unshift(ideaAttachment);
    }
    if (ideaAttachmentTruncated) {
      warnings.push('idea-studio.txt: text truncated');
    }

    const result = await executeRunDebate({
      command: 'run_debate',
      timeoutMs: timeoutSeconds * 1000,
      input: {
        question: finalQuestion,
        rounds: totalRounds,
        judge,
        mode,
        participants,
        noContext,
        executionCwd: executionCwd || undefined,
        attachments,
        workflowKind: 'project',
        ollamaModel: ollamaModel || undefined,
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

if (newsEvidenceKindSelect) {
  newsEvidenceKindSelect.addEventListener('change', () => {
    syncNewsEvidenceScopeUi();
    renderSelectedEvidence();
  });
  syncNewsEvidenceScopeUi();
}

if (newsQueryExpansionToggle) {
  newsQueryExpansionToggle.addEventListener('change', () => {
    syncNewsQueryTransformFields();
  });
  syncNewsQueryTransformFields();
}

if (newsForm) {
  newsForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(newsForm);
    const mode = String(formData.get('mode') || 'discussion');
    const modeMeta = getModeMeta(mode);
    const evidenceKind = normalizeEvidenceKind(formData.get('evidenceKind'));
    const submitMeta = getEvidenceKindMeta(evidenceKind);
    executeStatus.textContent = `${submitMeta.label} ${modeMeta.sessionWord}를 시작하는 중입니다...`;
    const rawQuestion = String(formData.get('question') || '').trim();
    const query = String(formData.get('query') || '').trim();
    const question = rawQuestion || (query ? `"${query}" 관련 최신 ${submitMeta.autoQuestionSuffix}` : '');

    if (!question) {
      executeStatus.textContent = `${submitMeta.label} 토론 질문이나 근거 탐색어를 입력하세요.`;
      return;
    }

    if (!selectedSnapshotId) {
      const collected = await collectSnapshotFromNewsForm({ autoSelect: true, silent: false });
      if (!collected.ok) {
        executeStatus.textContent = `${submitMeta.label} 토론을 시작하려면 먼저 근거 팩을 준비해야 합니다.`;
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
      executeStatus.textContent = `선택된 ${submitMeta.label} 근거 팩이 없습니다.`;
      return;
    }

    await executeRunDebate({
      command: 'run_debate',
      timeoutMs: timeoutSeconds * 1000,
      input: {
        question,
        rounds: totalRounds,
        judge,
        mode,
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

if (resumeSessionButton) {
  resumeSessionButton.addEventListener('click', async () => {
    if (!activeSessionId) {
      executeStatus.textContent = '먼저 세션을 선택하세요.';
      return;
    }

    if (!canResumeSession(activeSessionSummary)) {
      executeStatus.textContent = 'FAILED 또는 CANCELLED 세션만 이어서 재시작할 수 있습니다.';
      return;
    }

    executeStatus.textContent = `${activeSessionId} 세션을 멈춘 지점부터 재시작하는 중입니다...`;
    const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeoutMs: getActiveTimeoutMs() }),
    });
    if (!ok) {
      executeStatus.textContent = data.error || '세션 재시작에 실패했습니다.';
      return;
    }

    executeStatus.textContent = `${data.resumedFromSessionId || activeSessionId}에서 ${data.resumeStage || '중단 지점'}부터 새 세션 ${data.sessionId}로 재시작했습니다.`;
    await refreshSessions();
    if (data.sessionId) {
      await selectSession(data.sessionId);
    }
  });
}

if (continueSessionButton) {
  continueSessionButton.addEventListener('click', async () => {
    if (!activeSessionId) {
      executeStatus.textContent = '먼저 세션을 선택하세요.';
      return;
    }

    if (!canContinueSession(activeSessionSummary)) {
      executeStatus.textContent = 'COMPLETED 세션만 후속 토론으로 이어갈 수 있습니다.';
      return;
    }

    const focused = focusFollowUpComposer();
    if (!focused) {
      executeStatus.textContent = '결론을 불러온 뒤 새 주제를 입력할 수 있습니다. 잠시 후 다시 시도하세요.';
      return;
    }

    executeStatus.textContent = '결론 아래 새 주제 입력란에서 후속 토의를 시작할 수 있습니다.';
  });
}

async function startFollowUpSession() {
  if (!activeSessionId) {
    executeStatus.textContent = '먼저 세션을 선택하세요.';
    return;
  }

  if (!canContinueSession(activeSessionSummary)) {
    executeStatus.textContent = 'COMPLETED 세션만 후속 토론으로 이어갈 수 있습니다.';
    updateFollowUpStatus('COMPLETED 세션을 선택한 뒤 다시 시도하세요.');
    return;
  }

  const followUpConfig = resolveFollowUpConfiguration();
  if (!followUpConfig.ok) {
    executeStatus.textContent = followUpConfig.error;
    updateFollowUpStatus(followUpConfig.error);
    return;
  }

  const topics = normalizeFollowUpTopics(followUpTopicInput?.value);
  if (topics.length === 0) {
    executeStatus.textContent = '새 주제를 먼저 입력하세요.';
    updateFollowUpStatus('후속 토의를 시작하려면 결론 아래에 새 주제를 한 줄 이상 입력하세요.');
    followUpTopicInput?.focus();
    return;
  }

  currentParticipants = normalizeParticipants(followUpConfig.config.participants);
  renderParticipantLanes();
  followUpRequestInFlight = true;
  renderFollowUpComposer();
  executeStatus.textContent = `${activeSessionId} 결론을 바탕으로 새 주제 토의를 시작하는 중입니다...`;
  updateFollowUpStatus();

  let ok, data;
  try {
    ({ ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/follow-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: buildFollowUpQuestion(topics.join('\n')),
        timeoutMs: getActiveTimeoutMs(),
        rounds: followUpConfig.config.rounds,
        judge: followUpConfig.config.judge,
        mode: followUpConfig.config.mode,
        participants: followUpConfig.config.participants,
        noContext: followUpConfig.config.noContext,
        executionCwd: followUpConfig.config.executionCwd,
        snapshotId: followUpConfig.config.snapshotId,
        workflowKind: followUpConfig.config.workflowKind,
        ollamaModel: followUpConfig.config.ollamaModel,
      }),
    }));
  } finally {
    followUpRequestInFlight = false;
    renderFollowUpComposer();
  }

  if (!ok) {
    const errorMessage = data.error || '후속 토의 시작에 실패했습니다.';
    executeStatus.textContent = errorMessage;
    updateFollowUpStatus(errorMessage);
    return;
  }

  executeStatus.textContent = `${data.continuedFromSessionId || activeSessionId} 결론을 바탕으로 새 세션 ${data.sessionId} 후속 토의를 시작했습니다.`;
  if (followUpTopicInput) {
    followUpTopicInput.value = '';
  }
  updateFollowUpStatus('새 후속 토의가 시작되었습니다. 새 세션을 불러옵니다.');
  await refreshSessions();
  if (data.sessionId) {
    await selectSession(data.sessionId);
  }
}

if (followUpTopicInput) {
  followUpTopicInput.addEventListener('input', () => {
    updateFollowUpStatus();
  });

  followUpTopicInput.addEventListener('keydown', (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      void startFollowUpSession();
    }
  });
}

if (followUpStartButton) {
  followUpStartButton.addEventListener('click', () => {
    void startFollowUpSession();
  });
}

if (followUpSuggestions) {
  followUpSuggestions.addEventListener('click', (event) => {
    const button = event.target.closest('[data-follow-up-topic]');
    if (button) {
      addFollowUpTopic(button.getAttribute('data-follow-up-topic') || '');
    }
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

async function fetchActiveSessionExportPayload(statusLabel) {
  if (!activeSessionId) {
    executeStatus.textContent = '먼저 세션을 선택하세요.';
    return { ok: false };
  }

  executeStatus.textContent = `${activeSessionId} 세션을 ${statusLabel} 형식으로 내보내는 중입니다...`;
  const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=1`);
  if (!ok) {
    executeStatus.textContent = data.error || '세션 이벤트를 불러오지 못했습니다.';
    return { ok: false };
  }

  const session = cachedSessions.find((item) => item.sessionId === activeSessionId);
  if (!session) {
    executeStatus.textContent = '선택한 세션 요약을 찾지 못했습니다.';
    return { ok: false };
  }

  return { ok: true, session, events: data.events || [] };
}

if (exportMarkdownButton) {
  exportMarkdownButton.addEventListener('click', async () => {
    const result = await fetchActiveSessionExportPayload('Markdown');
    if (!result.ok) return;

    const markdown = buildSessionMarkdown(result.session, result.events);
    const filename = `${sanitizeFileName(result.session.question || activeSessionId)}-${activeSessionId.slice(0, 8)}.md`;
    downloadTextFile(filename, markdown, 'text/markdown;charset=utf-8');
    executeStatus.textContent = `Markdown을 내보냈습니다: ${filename}`;
  });
}

if (exportObsidianButton) {
  exportObsidianButton.addEventListener('click', async () => {
    const result = await fetchActiveSessionExportPayload('Obsidian');
    if (!result.ok) return;

    const note = buildSessionObsidianNote(result.session, result.events);
    const filename = `${sanitizeFileName(result.session.question || activeSessionId)}-${activeSessionId.slice(0, 8)}-obsidian.md`;
    const saveResult = await saveSessionNoteToObsidianVault(filename, note, result.session.workflowKind);

    if (saveResult.ok) {
      executeStatus.textContent = `Obsidian Vault에 저장했습니다: ${saveResult.data.relativePath}`;
      if (saveResult.data.openAfterSave && saveResult.data.obsidianUrl) {
        openObsidianUrl(saveResult.data.obsidianUrl);
      }
      return;
    }

    downloadTextFile(filename, note, 'text/markdown;charset=utf-8');
    executeStatus.textContent = `${saveResult.data?.error || 'Obsidian Vault 저장에 실패했습니다.'} 다운로드 파일로 대체했습니다: ${filename}`;
  });
}

if (exportSlidesButton) {
  exportSlidesButton.addEventListener('click', async () => {
    const result = await fetchActiveSessionExportPayload('슬라이드 개요');
    if (!result.ok) return;

    const outline = buildSessionSlidesOutline(result.session, result.events);
    const filename = `${sanitizeFileName(result.session.question || activeSessionId)}-${activeSessionId.slice(0, 8)}-slides.md`;
    downloadTextFile(filename, outline, 'text/markdown;charset=utf-8');
    executeStatus.textContent = `슬라이드 개요를 내보냈습니다: ${filename}`;
  });
}

if (useNewsQuestionButton && newsQuestionInput && newsQueryInput) {
  useNewsQuestionButton.addEventListener('click', () => {
    const evidenceMeta = getEvidenceKindMeta(getSelectedNewsEvidenceKind());
    const question = String(newsQuestionInput.value || '').trim();
    if (!question) {
      newsCollectStatus.textContent = `먼저 ${evidenceMeta.label} 토론 질문을 입력하세요.`;
      return;
    }

    newsQueryInput.value = question;
    newsCollectStatus.textContent = `${evidenceMeta.label} 토론 질문을 근거 탐색어로 복사했습니다.`;
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
    const projectIntent = chip.getAttribute('data-project-intent');

    if (target === 'news' && newsQuestionInput) {
      newsQuestionInput.value = template;
      newsQuestionInput.focus();
      return;
    }

    if (projectIntent && projectIdeaIntentInput) {
      projectIdeaIntentInput.value = projectIntent;
      renderProjectIdeaPreview();
    }

    if (projectQuestionInput) {
      projectQuestionInput.value = template;
      projectQuestionInput.focus();
    }
  });
});

[
  projectIdeaIntentInput,
  projectIdeaAudienceInput,
  projectIdeaSeedInput,
  projectIdeaProblemInput,
  projectIdeaSuccessMetricInput,
  projectIdeaConstraintsInput,
].forEach((control) => {
  control?.addEventListener('input', renderProjectIdeaPreview);
  control?.addEventListener('change', renderProjectIdeaPreview);
});

renderProjectIdeaPreview();

bindAdvancedToggle(projectAdvancedToggle, projectAdvancedFields);
bindAdvancedToggle(newsAdvancedToggle, newsAdvancedFields);

[
  ['project', projectTemplateSelect],
  ['news', newsTemplateSelect],
].forEach(([workflow, control]) => {
  control?.addEventListener('change', async () => {
    renderWorkflowTemplateEditor(workflow);
    await syncWorkflowOllamaModelField(workflow);
    renderFollowUpComposer();
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
      await syncWorkflowOllamaModelField(workflow);
      renderFollowUpComposer();
    });
  });

  controls.customCountSelect?.addEventListener('change', async () => {
    setWorkflowCustomParticipantCount(workflow, controls.customCountSelect.value);
    renderWorkflowCustomParticipants(workflow);
    renderWorkflowComposer(workflow);
    await syncWorkflowOllamaModelField(workflow);
    renderFollowUpComposer();
  });
});

projectJudgeSelect?.addEventListener('change', async () => {
  await syncWorkflowOllamaModelField('project');
  renderFollowUpComposer();
});

newsJudgeSelect?.addEventListener('change', async () => {
  await syncWorkflowOllamaModelField('news');
  renderFollowUpComposer();
});

projectNoContextToggle?.addEventListener('change', async () => {
  setSelectOptions(projectJudgeSelect, getWorkflowJudgeOptions('project'), 'claude');
  renderWorkflowTemplateEditor('project');
  await syncWorkflowOllamaModelField('project');
  renderFollowUpComposer();
});

projectExecutionCwdInput?.addEventListener('change', () => {
  renderFollowUpComposer();
});

newsExecutionCwdInput?.addEventListener('change', () => {
  renderFollowUpComposer();
});

getWorkflowControls('project').modeSelect?.addEventListener('change', () => {
  renderFollowUpComposer();
});

getWorkflowControls('news').modeSelect?.addEventListener('change', () => {
  renderFollowUpComposer();
});

getWorkflowControls('project').roundsInput?.addEventListener('change', () => {
  renderFollowUpComposer();
});

getWorkflowControls('news').roundsInput?.addEventListener('change', () => {
  renderFollowUpComposer();
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

obsidianConfigReloadButton?.addEventListener('click', async () => {
  if (obsidianConfigStatus) {
    obsidianConfigStatus.textContent = 'Obsidian 설정을 다시 불러오는 중입니다...';
  }
  await refreshObsidianConfigEditor();
});

obsidianConfigSaveButton?.addEventListener('click', async () => {
  if (obsidianConfigStatus) {
    obsidianConfigStatus.textContent = 'Obsidian 설정을 저장하는 중입니다...';
  }
  await saveObsidianConfigEditor();
});

async function initSettingsPage() {
  if (roleConfigStatus) {
    roleConfigStatus.textContent = '역할 설정을 불러오는 중입니다...';
  }
  await Promise.all([refreshRoleConfigEditor(), refreshObsidianConfigEditor()]);
}

async function initWorkbenchPage() {
  const tasks = [refreshRoleTemplates(), refreshSessions(), refreshProviderOptions(), fetchRuntimeDefaults()];
  if (snapshotList) {
    tasks.push(refreshSnapshots());
  }
  await Promise.all(tasks);
  await syncWorkflowOllamaModelField('project');
  await syncWorkflowOllamaModelField('news');
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
