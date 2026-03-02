const sessionList = document.getElementById('session-list');
const streamBox = document.getElementById('stream');
const timelineBox = document.getElementById('timeline');
const synthesisBox = document.getElementById('synthesis');
const configStateBox = document.getElementById('config-state');
const refreshButton = document.getElementById('refresh');
const replayButton = document.getElementById('replay');
const replayInput = document.getElementById('replay-seq');
const form = document.getElementById('provider-form');
const formStatus = document.getElementById('form-status');
const executeForm = document.getElementById('execute-form');
const executeStatus = document.getElementById('execute-status');
const stopSessionButton = document.getElementById('stop-session');
const stopTeamButton = document.getElementById('stop-team');
const exportMarkdownButton = document.getElementById('export-md');
const participantASelect = executeForm.querySelector('select[name="participantA"]');
const participantBSelect = executeForm.querySelector('select[name="participantB"]');
const judgeSelect = executeForm.querySelector('select[name="judge"]');

let activeSessionId = null;
let eventSource = null;
let lastSequence = 0;
let streamMessages = [];
let timelineEntries = [];
let synthesisContent = '';
let cachedSessions = [];

const MAX_FILES = 6;
const MAX_TEXT_FILE_CHARS = 12_000;
const MAX_IMAGE_DATA_URL_CHARS = 180_000;

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  return { ok: response.ok, status: response.status, data };
}

function formatTime(ts) {
  const date = new Date(ts);
  return date.toLocaleTimeString();
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

    if (trimmed === '') {
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

function renderMarkdown(target, markdown, fallbackText) {
  if (!markdown || String(markdown).trim() === '') {
    target.innerHTML = `<div class="markdown-body"><p>${escapeHtml(fallbackText)}</p></div>`;
    return;
  }
  target.innerHTML = `<div class="markdown-body">${markdownToHtml(markdown)}</div>`;
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
  if (file.type && file.type.startsWith('image/')) {
    return 'image';
  }
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
        attachments.push({
          name: file.name,
          kind,
          mimeType: file.type || 'image/unknown',
          content,
        });
        if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
          warnings.push(`${file.name}: image payload truncated`);
        }
        continue;
      }

      const text = await file.text();
      const content = text.slice(0, MAX_TEXT_FILE_CHARS);
      attachments.push({
        name: file.name,
        kind,
        mimeType: file.type || 'text/plain',
        content,
      });
      if (text.length > MAX_TEXT_FILE_CHARS) {
        warnings.push(`${file.name}: text truncated`);
      }
    } catch {
      warnings.push(`${file.name}: failed to read`);
    }
  }

  return { attachments, warnings };
}

function renderSessions(sessions) {
  if (!sessions || sessions.length === 0) {
    sessionList.innerHTML = '<p class="session-meta">No sessions yet.</p>';
    return;
  }

  sessionList.innerHTML = sessions
    .map((session) => {
      const active = session.sessionId === activeSessionId ? 'active' : '';
      return `
        <div class="session-item ${active}" data-session-id="${session.sessionId}">
          <strong>${session.question}</strong>
          <div class="session-meta">${session.status} · ${session.eventCount} events · ${formatTime(session.updatedAt)}</div>
        </div>
      `;
    })
    .join('');

  document.querySelectorAll('.session-item').forEach((item) => {
    item.addEventListener('click', () => {
      const id = item.getAttribute('data-session-id');
      if (id) selectSession(id);
    });
  });
}

function appendStream(provider, text) {
  const normalizedProvider = String(provider || 'unknown');
  const token = String(text || '');
  const last = streamMessages.at(-1);

  if (last && last.provider === normalizedProvider) {
    last.content += token;
  } else {
    streamMessages.push({ provider: normalizedProvider, content: token });
  }

  renderStream();
  streamBox.scrollTop = streamBox.scrollHeight;
}

function renderTimeline() {
  timelineBox.innerHTML = timelineEntries
    .map((entry) => `<div>${escapeHtml(entry)}</div>`)
    .join('');
  timelineBox.scrollTop = timelineBox.scrollHeight;
}

function renderStream() {
  if (streamMessages.length === 0) {
    renderMarkdown(streamBox, '', 'Waiting for stream...');
    return;
  }

  const markdown = streamMessages
    .map((message) => `### ${message.provider}\n\n${message.content}`)
    .join('\n\n---\n\n');

  renderMarkdown(streamBox, markdown, 'Waiting for stream...');
}

function renderSynthesis() {
  renderMarkdown(synthesisBox, synthesisContent, 'Waiting for synthesis...');
}

function handleEnvelope(envelope) {
  lastSequence = Math.max(lastSequence, envelope.sequence);
  const { event } = envelope;

  if (event.type === 'round_started') {
    timelineEntries.push(`Round ${event.payload.round} started (${formatTime(event.timestamp)})`);
  }

  if (event.type === 'agent_chunk') {
    appendStream(event.payload.provider, event.payload.token);
  }

  if (event.type === 'round_finished') {
    timelineEntries.push(`Round ${event.payload.round} finished (${event.payload.messages.length} messages)`);
  }

  if (event.type === 'synthesis_ready') {
    if (event.payload.status === 'started') {
      synthesisContent = 'Synthesizing...';
    } else if (event.payload.content) {
      synthesisContent = event.payload.content;
    }
  }

  if (event.type === 'error') {
    timelineEntries.push(`Error: ${event.payload.code}`);
  }

  if (event.type === 'cancelled') {
    timelineEntries.push(`Cancelled: ${event.payload.reason}`);
  }

  renderTimeline();
  renderSynthesis();
}

async function replayEvents(fromSequence) {
  if (!activeSessionId) return;
  const { data, ok } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=${fromSequence}`);
  if (!ok) return;
  data.events.forEach(handleEnvelope);
}

function connectStream(sessionId) {
  if (eventSource) eventSource.close();
  eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

  eventSource.addEventListener('debate', (event) => {
    try {
      const envelope = JSON.parse(event.data);
      handleEnvelope(envelope);
    } catch {
      return;
    }
  });
}

async function selectSession(sessionId) {
  activeSessionId = sessionId;
  lastSequence = 0;
  streamMessages = [];
  timelineEntries = [];
  synthesisContent = '';
  renderStream();
  renderSynthesis();
  renderTimeline();
  await replayEvents(1);
  connectStream(sessionId);
  await refreshSessions();
}

async function refreshSessions() {
  const { data } = await fetchJson('/api/sessions');
  cachedSessions = data.sessions || [];
  renderSessions(cachedSessions);
}

function formatDateTime(ts) {
  const date = new Date(ts);
  return date.toLocaleString();
}

function sanitizeFileName(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'debate';
}

function buildSessionMarkdown(session, envelopes) {
  const events = (envelopes || []).map((envelope) => envelope.event);
  const roundFinishedEvents = events.filter((event) => event.type === 'round_finished');
  const synthesisEvent = [...events].reverse().find(
    (event) => event.type === 'synthesis_ready' && event.payload?.status === 'completed'
  );
  const errorEvents = events.filter((event) => event.type === 'error');
  const cancelledEvent = [...events].reverse().find((event) => event.type === 'cancelled');

  const lines = [];
  lines.push(`# Debate: ${session?.question || 'Untitled'}`);
  lines.push('');
  lines.push(`- Session ID: \`${session?.sessionId || activeSessionId || 'unknown'}\``);
  lines.push(`- Status: \`${session?.status || 'unknown'}\``);
  if (session?.createdAt) {
    lines.push(`- Created: ${formatDateTime(session.createdAt)}`);
  }
  if (session?.updatedAt) {
    lines.push(`- Updated: ${formatDateTime(session.updatedAt)}`);
  }
  lines.push('');

  if (roundFinishedEvents.length > 0) {
    lines.push('## Debate Process');
    lines.push('');
    for (const roundEvent of roundFinishedEvents) {
      lines.push(`### Round ${roundEvent.payload.round}`);
      lines.push('');
      for (const message of roundEvent.payload.messages) {
        lines.push(`#### ${message.provider} (${message.phase})`);
        lines.push('');
        lines.push(message.content || '');
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push('## Debate Process');
    lines.push('');
    lines.push('_No completed round messages found in event log._');
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

function buildProviderOptionLabel(provider) {
  if (provider.available) {
    return provider.label;
  }
  return `${provider.label} (unavailable)`;
}

function setSelectOptions(select, options, preferredValue) {
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

async function refreshProviderOptions() {
  const { ok, data } = await fetchJson('/api/providers');
  if (!ok) return;

  const providerOptions = (data.providers || []).map((provider) => ({
    value: provider.name,
    label: buildProviderOptionLabel(provider),
    disabled: !provider.available,
    title: provider.reason || '',
  }));

  const availableProviders = providerOptions.filter((option) => !option.disabled);
  const participantOptions = providerOptions.length > 0 ? providerOptions : [
    { value: 'codex', label: 'codex', disabled: false },
    { value: 'claude', label: 'claude', disabled: false },
  ];

  setSelectOptions(participantASelect, participantOptions, 'codex');
  setSelectOptions(participantBSelect, participantOptions, 'claude');

  if (participantASelect.value === participantBSelect.value) {
    const fallback = availableProviders.find((option) => option.value !== participantASelect.value);
    if (fallback) {
      participantBSelect.value = fallback.value;
    }
  }

  const judgeProviderNames = (data.judgeOptions || []).filter((value) => value !== 'both');
  const judgeProviderOptions = judgeProviderNames.length > 0
    ? judgeProviderNames.map((name) => {
      const matching = providerOptions.find((option) => option.value === name);
      return matching
        ? matching
        : { value: name, label: name, disabled: false, title: '' };
    })
    : providerOptions;

  const judgeOptions = [
    ...judgeProviderOptions,
    { value: 'both', label: 'both', disabled: false, title: 'Prefer Claude as synthesizer' },
  ];

  setSelectOptions(judgeSelect, judgeOptions, 'claude');
}

function toInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  return Math.trunc(num);
}

async function executeRunDebate(payload) {
  const { ok, data } = await fetchJson('/api/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!ok) {
    executeStatus.textContent = data.error || 'Failed to execute command.';
    return;
  }

  executeStatus.textContent = `Session ${data.sessionId} started (timeout ${Math.round((data.timeoutMs || 0) / 1000)}s).`;
  await refreshSessions();
  if (data.sessionId) {
    await selectSession(data.sessionId);
  }
}

function renderConfigState(state) {
  const active = state.active;
  const pending = state.pending;
  const activeProviders = Object.values(active.providers || {});
  const pendingProviders = pending ? Object.values(pending.providers || {}) : [];

  configStateBox.innerHTML = `
    <div class="config-panel">
      <h3>Active (v${active.version})</h3>
      <div class="config-grid">
        ${activeProviders.length === 0 ? '<div>No providers configured.</div>' : ''}
        ${activeProviders
          .map(
            (provider) =>
              `<div>${provider.id} · ${provider.type} · ${provider.model}</div>`
          )
          .join('')}
      </div>
    </div>
    <div class="config-panel">
      <h3>Pending ${pending ? `(v${pending.version})` : ''}</h3>
      <div class="config-grid">
        ${pending ? `<div>Status: ${pending.pendingStatus}</div>` : '<div>No pending changes.</div>'}
        ${pending ? `<div>Schema: ${pending.schemaStatus}</div>` : ''}
        ${pending ? `<div>Connectivity: ${pending.connectivityStatus}</div>` : ''}
        ${pending?.validationMessage ? `<div>${pending.validationMessage}</div>` : ''}
        ${pendingProviders
          .map(
            (provider) =>
              `<div>${provider.id} · ${provider.type} · ${provider.model}</div>`
          )
          .join('')}
      </div>
    </div>
  `;
}

async function refreshConfigState() {
  const { data } = await fetchJson('/api/config/state');
  renderConfigState(data);
  return data;
}

refreshButton.addEventListener('click', async () => {
  await refreshSessions();
  await refreshProviderOptions();
  await refreshConfigState();
});

replayButton.addEventListener('click', async () => {
  const sequence = Number(replayInput.value || '1');
  await replayEvents(sequence);
});

executeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  executeStatus.textContent = 'Submitting command...';

  const formData = new FormData(executeForm);
  const question = String(formData.get('question') || '').trim();
  const participantA = String(formData.get('participantA') || 'codex');
  const participantB = String(formData.get('participantB') || 'claude');

  if (!question) {
    executeStatus.textContent = 'Question is required.';
    return;
  }

  if (participantA === participantB) {
    executeStatus.textContent = 'Participants must be different.';
    return;
  }

  const rounds = toInt(formData.get('rounds'), 3);
  const timeoutSeconds = toInt(formData.get('timeoutSeconds'), 900);
  const judge = String(formData.get('judge') || 'claude');
  const executionCwd = String(formData.get('executionCwd') || '').trim();
  const noContext = formData.get('noContext') !== null;
  const filesInput = executeForm.querySelector('input[name="questionFiles"]');
  const { attachments, warnings } = await buildQuestionAttachments(filesInput?.files);

  const snapshotId = debateSnapshotInput?.value?.trim() || '';

  await executeRunDebate({
    command: 'run_debate',
    timeoutMs: timeoutSeconds * 1000,
    input: {
      question,
      rounds,
      judge,
      participants: [participantA, participantB],
      noContext,
      executionCwd: executionCwd || undefined,
      attachments,
      snapshotId: snapshotId || undefined,
    },
  });

  if (warnings.length > 0) {
    executeStatus.textContent += ` (attachments: ${warnings.join(', ')})`;
  }
});

stopSessionButton.addEventListener('click', async () => {
  if (!activeSessionId) {
    executeStatus.textContent = 'Select a session first.';
    return;
  }
  executeStatus.textContent = `Stopping ${activeSessionId}...`;
  const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/stop`, {
    method: 'POST',
  });
  if (!ok) {
    executeStatus.textContent = data.error || 'Failed to stop session.';
    return;
  }
  executeStatus.textContent = `Stop requested for ${activeSessionId}.`;
  await refreshSessions();
});

stopTeamButton.addEventListener('click', async () => {
  executeStatus.textContent = 'Stopping all running sessions...';
  const { ok, data } = await fetchJson('/api/sessions/stop', {
    method: 'POST',
  });
  if (!ok) {
    executeStatus.textContent = data.error || 'Failed to stop all sessions.';
    return;
  }
  executeStatus.textContent = `Stop requested for ${data.stoppedSessions ?? 0} running session(s).`;
  await refreshSessions();
});

exportMarkdownButton.addEventListener('click', async () => {
  if (!activeSessionId) {
    executeStatus.textContent = 'Select a session first.';
    return;
  }

  executeStatus.textContent = `Exporting markdown for ${activeSessionId}...`;
  const { ok, data } = await fetchJson(`/api/sessions/${activeSessionId}/events?fromSequence=1`);
  if (!ok) {
    executeStatus.textContent = data.error || 'Failed to load session events.';
    return;
  }

  const session = cachedSessions.find((item) => item.sessionId === activeSessionId);
  const markdown = buildSessionMarkdown(session, data.events || []);
  const fileSlug = sanitizeFileName(session?.question || activeSessionId);
  const filename = `${fileSlug}-${activeSessionId.slice(0, 8)}.md`;
  downloadTextFile(filename, markdown, 'text/markdown;charset=utf-8');
  executeStatus.textContent = `Markdown exported: ${filename}`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formStatus.textContent = 'Submitting...';
  const formData = new FormData(form);
  const state = await refreshConfigState();

  const payload = {
    id: String(formData.get('id') || ''),
    type: String(formData.get('type') || 'ollama-compat'),
    baseUrl: String(formData.get('baseUrl') || ''),
    model: String(formData.get('model') || ''),
    apiKey: String(formData.get('apiKey') || ''),
    expectedVersion: state.active.version,
  };

  const { ok, data } = await fetchJson('/api/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!ok) {
    formStatus.textContent = data.error || 'Failed to register provider.';
    return;
  }

  form.reset();
  formStatus.textContent = 'Pending config created. Validation running...';
  renderConfigState(data);
});

// ── Tab navigation ──────────────────────────────────────────────────────────

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabPanels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(`tab-${target}`);
      if (panel) panel.classList.add('active');

      if (target === 'news') {
        refreshSnapshots();
      }
    });
  });
}

// ── News tab ─────────────────────────────────────────────────────────────────

let selectedSnapshotId = null;

const snapshotList = document.getElementById('snapshot-list');
const newsCollectForm = document.getElementById('news-collect-form');
const newsCollectStatus = document.getElementById('news-collect-status');
const articleModal = document.getElementById('article-modal');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalClose = document.getElementById('modal-close');
const debateSnapshotInput = document.getElementById('debate-snapshot-id');

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

function renderSnapshots(snapshots) {
  if (!snapshots || snapshots.length === 0) {
    snapshotList.innerHTML = '<p class="session-meta">스냅샷이 없습니다. 뉴스를 수집해보세요.</p>';
    return;
  }

  snapshotList.innerHTML = snapshots
    .map((snap) => {
      const isSelected = snap.id === selectedSnapshotId ? 'selected' : '';
      const articleCount = snap.articleCount ?? snap.articles?.length ?? '?';
      const date = formatDate(snap.createdAt);
      return `
        <div class="snapshot-item ${isSelected}" data-snap-id="${escapeHtml(snap.id)}">
          <div class="snapshot-item-header">
            <span class="snapshot-id">${escapeHtml(snap.id)}</span>
            <span class="snapshot-query">"${escapeHtml(snap.query || '')}"</span>
          </div>
          <div class="snapshot-meta">${date}  ·  ${articleCount}건</div>
          <div class="snapshot-actions">
            <button class="button" data-action="use" data-snap-id="${escapeHtml(snap.id)}">토론에 사용</button>
            <button class="button subtle" data-action="view" data-snap-id="${escapeHtml(snap.id)}">기사 보기</button>
            <button class="button subtle" data-action="delete" data-snap-id="${escapeHtml(snap.id)}">삭제</button>
          </div>
        </div>
      `;
    })
    .join('');

  snapshotList.querySelectorAll('button[data-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const snapId = btn.getAttribute('data-snap-id');
      if (action === 'use') useSnapshot(snapId);
      else if (action === 'view') viewSnapshot(snapId);
      else if (action === 'delete') deleteSnapshot(snapId);
    });
  });
}

async function refreshSnapshots() {
  snapshotList.innerHTML = '<p class="session-meta">로딩 중...</p>';
  const { ok, data } = await fetchJson('/api/snapshots');
  if (!ok) {
    snapshotList.innerHTML = '<p class="session-meta">불러오기 실패.</p>';
    return;
  }
  renderSnapshots(data.snapshots || []);
}

function useSnapshot(snapId) {
  selectedSnapshotId = snapId;

  // Update selected highlight
  document.querySelectorAll('.snapshot-item').forEach((item) => {
    item.classList.toggle('selected', item.getAttribute('data-snap-id') === snapId);
  });

  // Propagate to debate form if the field exists
  if (debateSnapshotInput) {
    debateSnapshotInput.value = snapId;
  }

  newsCollectStatus.textContent = `선택됨: ${snapId} (Debate 탭의 Snapshot ID 필드에 반영되었습니다)`;
}

async function viewSnapshot(snapId) {
  modalTitle.textContent = `기사 목록 — ${snapId}`;
  modalBody.innerHTML = '<p class="session-meta">로딩 중...</p>';
  articleModal.style.display = 'flex';

  const { ok, data } = await fetchJson(`/api/snapshots/${encodeURIComponent(snapId)}`);
  if (!ok) {
    modalBody.innerHTML = '<p class="session-meta">불러오기 실패.</p>';
    return;
  }

  const articles = data.articles || data.snapshot?.articles || [];
  if (articles.length === 0) {
    modalBody.innerHTML = '<p class="session-meta">기사가 없습니다.</p>';
    return;
  }

  modalBody.innerHTML = articles
    .map((article) => {
      const titleHtml = article.url
        ? `<a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title || article.url)}</a>`
        : escapeHtml(article.title || '제목 없음');
      return `
        <div class="article-item">
          <div class="article-title">${titleHtml}</div>
          <div class="article-meta">${escapeHtml(article.source || '')}${article.publishedAt ? '  ·  ' + escapeHtml(String(article.publishedAt).slice(0, 10)) : ''}</div>
          <div class="article-snippet">${escapeHtml(article.snippet || article.description || '')}</div>
        </div>
      `;
    })
    .join('');
}

async function deleteSnapshot(snapId) {
  if (!confirm(`스냅샷 "${snapId}"를 삭제하시겠습니까?`)) return;

  const { ok, data } = await fetchJson(`/api/snapshots/${encodeURIComponent(snapId)}`, {
    method: 'DELETE',
  });

  if (!ok) {
    newsCollectStatus.textContent = data.error || '삭제 실패.';
    return;
  }

  if (selectedSnapshotId === snapId) {
    selectedSnapshotId = null;
    if (debateSnapshotInput) debateSnapshotInput.value = '';
  }

  newsCollectStatus.textContent = `삭제됨: ${snapId}`;
  await refreshSnapshots();
}

newsCollectForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const formData = new FormData(newsCollectForm);
  const query = String(formData.get('query') || '').trim();
  if (!query) {
    newsCollectStatus.textContent = 'Query를 입력하세요.';
    return;
  }

  const newsMode = String(formData.get('newsMode') || 'split');
  const sources = formData.getAll('sources').map(String);

  newsCollectStatus.textContent = '수집 중...';
  document.getElementById('news-collect-btn').disabled = true;

  const { ok, data } = await fetchJson('/api/snapshots/collect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, newsMode, sources }),
  });

  document.getElementById('news-collect-btn').disabled = false;

  if (!ok) {
    newsCollectStatus.textContent = data.error || '수집 실패.';
    return;
  }

  const snapId = data.snapshotId || data.id || '';
  const count = data.articleCount ?? data.count ?? '?';
  newsCollectStatus.textContent = `수집 완료: ${snapId} (${count}건)`;
  await refreshSnapshots();
});

modalClose.addEventListener('click', () => {
  articleModal.style.display = 'none';
});

articleModal.addEventListener('click', (e) => {
  if (e.target === articleModal) {
    articleModal.style.display = 'none';
  }
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  initTabs();
  renderStream();
  renderSynthesis();
  await refreshSessions();
  await refreshProviderOptions();
  await refreshConfigState();
  setInterval(async () => {
    await refreshProviderOptions();
    await refreshConfigState();
  }, 5000);
}

init();
