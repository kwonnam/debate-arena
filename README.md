# DEBATE ARENA

**Let two AIs fight for the best answer — then turn the winner into code.**

[한국어](./README.KR.md) | [npm](https://www.npmjs.com/package/debate-arena) | [GitHub](https://github.com/kwonnam/debate-arena)

---

## Why AI Debate?

A single AI gives you *one* perspective. But real engineering decisions need trade-offs, counter-arguments, and stress-testing. **DEBATE ARENA** pits Codex (OpenAI) against Claude (Anthropic) in a structured, multi-round debate — so you get battle-tested answers, not just auto-complete.

> One AI is an opinion. Two AIs debating is due diligence.

---

## Three Modes

### 1. Agent vs Agent — Structured AI Debate

Two AI agents argue your question from opposing sides across multiple rounds, then a judge synthesizes the best answer.

```bash
da "Should we use REST or GraphQL for our new API?"
```

```
┌─────────────────────────────────────────────────┐
│  Round 1                                        │
│  Codex: "REST is simpler, better caching..."    │
│  Claude: "GraphQL reduces over-fetching..."     │
│                                                 │
│  Round 2                                        │
│  Codex: "But GraphQL adds complexity..."        │
│  Claude: "Schema-first approach prevents..."    │
│                                                 │
│  Round 3                                        │
│  Codex: "For this use case, consider..."        │
│  Claude: "Agreed, but also note..."             │
│                                                 │
│  ✨ Synthesis                                   │
│  "Use REST for public APIs, GraphQL for..."     │
└─────────────────────────────────────────────────┘
```

### 2. You + Agents — Interactive 3-Way Discussion

Jump into the debate as a third participant. Steer the conversation, challenge assumptions, or provide domain context that only you know.

```bash
da "Best state management for React?" -i
```

```
┌─────────────────────────────────────────────────┐
│  Round 1                                        │
│  Codex: "Redux Toolkit for large apps..."       │
│  Claude: "Zustand is lighter and simpler..."    │
│                                                 │
│  👤 You: "We need SSR support and the team      │
│           is junior — simplicity matters most"  │
│                                                 │
│  Round 2                                        │
│  Codex: "Given SSR needs, consider..."          │
│  Claude: "For junior teams, Zustand's API..."   │
│  ...                                            │
└─────────────────────────────────────────────────┘
```

### 3. Debate → Code — Plan Mode

The agents debate *how* to change your code, then you apply the consensus directly to your codebase. From discussion to implementation in one flow.

```bash
da "How should we refactor the auth module?" --plan
```

```
┌─────────────────────────────────────────────────┐
│  Debate: 3 rounds on refactoring strategy       │
│  ...                                            │
│  ✨ Consensus: "Extract JWT logic into          │
│     service layer, add refresh token rotation"  │
│                                                 │
│  Apply changes to codebase? (y/n)               │
│  > Codex applies the agreed-upon changes...     │
└─────────────────────────────────────────────────┘
```

---

<!-- TODO: Add demo GIF here -->
<!-- ![demo](./assets/demo.gif) -->

## Quick Start

### Prerequisites

DEBATE ARENA shells out to AI CLI tools. You need at least two of the following:

#### 1. Node.js >= 18

```bash
# Check version
node --version

# Install via nvm (recommended)
nvm install 18
nvm use 18
```

#### 2. Codex CLI (OpenAI)

```bash
npm install -g @openai/codex

# Set your OpenAI API key
export OPENAI_API_KEY="sk-..."

# Verify
codex --version
```

#### 3. Claude CLI (Anthropic)

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Authenticate
claude login

# Verify
claude --version
```

#### 4. Gemini CLI (Google) — optional

```bash
npm install -g @google/gemini-cli

# Authenticate
gemini auth login

# Verify
gemini --version
```

---

### Install debate-arena

#### Option A: Install from npm (recommended)

```bash
npm install -g debate-arena

# Verify
da --version
```

#### Option B: Run from source

```bash
# Clone the repository
git clone https://github.com/kwonnam/debate-arena.git
cd debate-arena

# Install dependencies
npm install

# Build
npm run build

# Run directly
node dist/bin/cli.js

# Or link globally so da command is available
npm link
da
```

#### Option C: Build a local package and move it to another environment

```bash
# Create a distributable tarball in .release/
npm run package:local

# Copy the generated .tgz file to another machine, then install it there
npm install -g ./debate-arena-*.tgz
```

---

### Basic Usage

```bash
# Start a debate (one-shot)
da "Your question here"

# 5-round debate
da "Compare ORMs for Node.js" -r 5

# Join as a participant
da "Microservices vs monolith?" -i

# Debate and apply code changes
da "Refactor this module" --plan

# Include files as context
da "How to improve this code?" --files src/index.ts src/utils.ts
```

---

### Interactive REPL

Running `da` without arguments launches the interactive REPL:

```bash
da
```

```
╔═══════════════════════════════════════╗
║                                       ║
║             FIGHT FOR ME              ║
║   AI Debate Arena - Codex vs Claude   ║
║                                       ║
╚═══════════════════════════════════════╝

  v0.5.2 Type /help for commands, /exit to quit.

ffm >
```

Inside the REPL, use slash commands:

```bash
ffm > /status                          # Check which agents are available
ffm > /rounds 2                        # Set 2 debate rounds
ffm > /participants codex gemini       # Switch participants
ffm > /join Should we use TypeScript?  # Start an interactive debate
ffm > /plan Refactor the auth module   # Debate and apply code changes
ffm > /help                            # Show all commands
ffm > /exit                            # Quit
```

---

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --rounds <n>` | Number of debate rounds | `3` |
| `-j, --judge <provider>` | Judge for synthesis: `codex`, `claude`, `both` | `claude` |
| `-f, --format <format>` | Output format: `pretty`, `json`, `markdown` | `pretty` |
| `--plan` | Enable plan mode (debate → apply code) | `false` |
| `-i, --interactive` | Join as a third participant | `false` |
| `--no-stream` | Disable streaming output | - |
| `--no-synthesis` | Skip final synthesis | - |
| `--no-context` | Disable project context collection | - |
| `--files <paths...>` | Include specific files as context | - |
| `--news [query]` | Collect news evidence before debate | - |
| `--news-quiet` | Suppress article listing | - |
| `--news-snapshot <path>` | Reuse a saved snapshot file | - |

## REPL Commands

| Command | Description |
|---------|-------------|
| `/plan <topic>` | Debate & apply code changes |
| `/join <topic>` | Interactive 3-way debate (You + Codex + Claude). Alias: `/i` |
| `/rounds <n>` | Set number of debate rounds |
| `/judge <provider>` | Set judge: `<provider-id>` or `both` |
| `/format <format>` | Output format: `pretty`, `json`, `markdown` |
| `/stream` | Toggle streaming output |
| `/files <paths...>` | Set context files (replaces current list) |
| `/context` | Toggle project context collection. Alias: `/nocontext` |
| `/participants <p1> <p2>` | Set debate participants by provider id (e.g., `ollama-local cloud-gpt`) |
| `/output <path>` | Save debate to a markdown file |
| `/news <query>` | Collect news articles as debate evidence |
| `/model codex <name>` | Set Codex model |
| `/model claude <name>` | Set Claude model |
| `/model list` | Show configured models |
| `/config` | Manage persistent configuration |
| `/status` | Check agent CLI status |
| `/dashboard` | Start local dashboard server |
| `/stop` | Stop runtime/processes (`/stop team` stops dashboard sessions/server only) |
| `/help` | Show help |
| `/exit` | Exit the REPL. Alias: `/quit` |

## Dashboard Command Gateway & Team Stop

The dashboard now supports:

- allowlisted command execution (`run_debate`)
- real-time monitoring (SSE stream + replay)
- dynamic provider options (participant/judge lists from server-side provider availability)
- per-session stop
- **team stop** (stop all running dashboard sessions at once)
- markdown export for selected session (debate process + final conclusion)

### Run the dashboard

```bash
da
ffm > /dashboard
```

Open the printed URL (default: `http://localhost:3847`).

### Execute a debate from dashboard

1. Fill **Command Gateway** form:
   - question / rounds / participants / judge / timeout
   - optional `executionCwd` (run location)
   - optional `no-context`
   - optional file/image attachments
2. Click **Run Debate**
3. Monitor in Sessions + Live Stream + Timeline
4. Click **Export Selected as Markdown** in Sessions to save process + synthesis as `.md`

### Attachment behavior

- Text files: embedded as text attachment for debate context
- Images: attached as image payload for multimodal providers
- For vision, use Ollama with a vision-capable model (for example `llava`)

```bash
export OLLAMA_BASE_URL="http://localhost:11434"
export OLLAMA_MODEL="llava"
```

### Stop behavior

- **Stop Selected Session** (dashboard button): cancels only the selected session
- **Stop All Running Sessions** (dashboard button): cancels every running dashboard session
- **`/stop team`** (REPL): stops all local dashboard sessions and the local dashboard server in current process
- **`/stop`** (REPL): performs team stop first, then stops other running debate-arena processes (legacy process scan behavior)

## News Evidence

DEBATE ARENA can collect real-time news articles and inject them as evidence into the debate, so the AIs argue based on actual recent information.

### Supported news providers

| Provider | Env var | Notes |
|----------|---------|-------|
| **Brave Search** (default) | `BRAVE_API_KEY` | Free tier available at brave.com/search/api |
| **NewsAPI** | `NEWS_API_KEY` | newsapi.org |
| **RSS feeds** | — | Any public RSS/Atom URL |

### Collect news before a debate

```bash
# One-shot: collect news then debate
da "Will the Fed cut rates this year?" --news

# Suppress article listing (quiet mode)
da "Impact of AI on jobs" --news --news-quiet

# Reuse a previously saved snapshot
da "Follow-up question" --news-snapshot ./ffm-snapshots/snap-abc123.json
```

### Collect news inside REPL

```bash
ffm > /news federal reserve rate cut 2026
# → fetches articles, saves snapshot, injects into next debate

ffm > Federal Reserve가 금리를 내릴까?
# → AIs debate using the collected articles as evidence
```

### News debate modes

- **unified** — all evidence is shared with both participants at once
- **split** — each participant sees evidence relevant to their side

### News tab in Dashboard

Open the dashboard (`/dashboard`) and click the **News** tab to:
- Browse the saved snapshot library
- Inspect individual articles per snapshot
- Launch a debate directly from a snapshot

### Configure news providers (`config.v2.json`)

```json
{
  "news": {
    "providers": {
      "brave":   { "enabled": true },
      "newsapi": { "enabled": false },
      "rss":     { "enabled": true, "feeds": ["https://feeds.bbci.co.uk/news/rss.xml"] }
    },
    "maxArticlesPerProvider": 10,
    "deduplication": true
  }
}
```

```bash
export BRAVE_API_KEY="BSA..."
export NEWS_API_KEY="..."    # only if newsapi is enabled
```

---

## Configuration

Default settings can be changed via `da config` or by editing `~/.debate-arena/config.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `codexCommand` | Codex CLI command | `codex exec --skip-git-repo-check -` |
| `claudeCommand` | Claude CLI command | `claude -p` |
| `commandTimeoutMs` | Agent command timeout (ms) | `180000` |
| `defaultRounds` | Default debate rounds | `3` |
| `defaultJudge` | Default judge | `claude` |
| `defaultFormat` | Default output format | `pretty` |
| `stream` | Enable streaming | `true` |
| `codexModel` | Codex model override | - |
| `claudeModel` | Claude model override | - |
| `claudeApplyCommand` | Claude CLI command for plan mode | `claude -p --allowedTools "Edit Write Bash Read"` |
| `applyTimeoutMs` | Apply command timeout (ms) | `300000` |

```bash
# View current config
da config list

# Change a setting
da config set defaultRounds 5
da config set defaultJudge both
```

### Advanced providers (`config.v2.json`)

You can add multiple Ollama profiles and cloud models by editing:

`~/.debate-arena/config.v2.json`

For local testing, this is also supported in the **current working directory**:

`./config.v2.json`

```json
{
  "version": 2,
  "providers": {
    "codex": {
      "type": "cli",
      "command": "codex exec --skip-git-repo-check -",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 128000 }
    },
    "claude": {
      "type": "cli",
      "command": "claude -p",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 200000 }
    },
    "gemini": {
      "type": "cli",
      "command": "gemini -p {prompt}",
      "model": "default",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 1000000 }
    },
    "ollama-local": {
      "type": "ollama-compat",
      "baseUrl": "http://127.0.0.1:11434",
      "model": "llama3.2",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 131072 }
    },
    "ollama-vision": {
      "type": "ollama-compat",
      "baseUrl": "http://127.0.0.1:11434",
      "model": "llava",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 131072 }
    },
    "ollama-cloud-qwen3-coder-next": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "qwen3-coder-next",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    },
    "ollama-cloud-glm-5": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "glm-5:cloud",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    },
    "ollama-cloud-kimi-k2-5": {
      "type": "ollama-compat",
      "baseUrl": "https://ollama.com",
      "model": "kimi-k2.5:cloud",
      "apiKeyEnvVar": "OLLAMA_API_KEY",
      "capabilities": { "supportsStreaming": true, "maxContextTokens": 262144 }
    }
  },
  "debate": {
    "defaultRounds": 3,
    "defaultJudge": "ollama-cloud-qwen3-coder-next",
    "defaultFormat": "pretty",
    "stream": true,
    "commandTimeoutMs": 180000,
    "applyTimeoutMs": 300000
  }
}
```

Notes:
- Use unique provider IDs (`ollama-local`, `ollama-cloud-qwen3-coder-next`, etc.).
- CLI providers (Codex/Claude/Gemini) use:
  - `type: "cli"`
  - `command`: actual executable command
  - optional `model`: if omitted/empty/`default`, CLI default model is used
  - if `model` is set (and command has no `--model`), ffm appends `--model <value>`
- `ollama-compat` works with local Ollama **and** OpenAI-compatible cloud endpoints.
- API key setting options:
  - `ollama_api_key` (or `ollamaApiKey`) for Ollama Cloud
  - `openai_api_key` (or `openaiApiKey`, `apiKey`) directly in config
  - `apiKeyEnvVar` + environment variable
- For this project, set `baseUrl` to `https://ollama.com` (the runtime appends `/v1/...`).
- Ollama Cloud recommends `apiKeyEnvVar: "OLLAMA_API_KEY"` and cloud models from `https://ollama.com/search?c=cloud&o=newest`.
- Load priority for v2 config:
  1. `FFM_CONFIG_V2` (if set)
  2. `./config.v2.json` (current directory)
  3. `~/.debate-arena/config.v2.json`
- Dashboard provider dropdowns refresh automatically from this file.
- Sample file: `config.v2.example.json`

## Troubleshooting

### `/status` shows an agent as unavailable

The agent CLI is not installed or not in your PATH. Install the missing CLI and ensure its API key is set:

```bash
# Check PATH
which codex
which claude
which gemini

# Check API keys
echo $OPENAI_API_KEY    # for Codex
echo $ANTHROPIC_API_KEY # for Claude (if needed)
```

### Debate times out

Increase the command timeout:

```bash
da config set commandTimeoutMs 300000
```

### Running from source — "Cannot find module"

Make sure you've built the project first:

```bash
npm run build
node dist/bin/cli.js
```

For development with auto-rebuild on save:

```bash
npm run dev   # watches and rebuilds on change
```

---

## How It Works

```
  You
   │
   ▼
┌──────┐     ┌───────────────────────────────────┐
│ ffm  │────▶│         Debate Engine              │
└──────┘     │                                     │
             │  ┌───────┐  Round N  ┌────────┐    │
             │  │ Codex │◄────────►│ Claude │    │
             │  └───────┘          └────────┘    │
             │       │                  │         │
             │       ▼                  ▼         │
             │  ┌─────────────────────────────┐  │
             │  │    Judge (Synthesis)         │  │
             │  └─────────────────────────────┘  │
             └───────────────┬───────────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
         Pretty Text    JSON Output   Code Changes
                                      (Plan Mode)
```

1. Your question is sent to both **Codex** and **Claude**
2. Each agent responds with their perspective
3. They debate back and forth for N rounds
4. A judge synthesizes the debate into a final consensus
5. In **plan mode**, the consensus is applied to your codebase

## License

MIT
