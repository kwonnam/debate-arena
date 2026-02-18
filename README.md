# fight-for-me

**Let two AIs fight for the best answer — then turn the winner into code.**

[한국어](./README.KR.md) | [npm](https://www.npmjs.com/package/fight-for-me) | [GitHub](https://github.com/Leekee0905/fight-for-me)

---

## Why AI Debate?

A single AI gives you *one* perspective. But real engineering decisions need trade-offs, counter-arguments, and stress-testing. **fight-for-me** pits Codex (OpenAI) against Claude (Anthropic) in a structured, multi-round debate — so you get battle-tested answers, not just auto-complete.

> One AI is an opinion. Two AIs debating is due diligence.

---

## Three Modes

### 1. Agent vs Agent — Structured AI Debate

Two AI agents argue your question from opposing sides across multiple rounds, then a judge synthesizes the best answer.

```bash
ffm "Should we use REST or GraphQL for our new API?"
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
ffm "Best state management for React?" -i
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
ffm "How should we refactor the auth module?" --plan
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

- [Node.js](https://nodejs.org/) >= 18
- [Codex CLI](https://github.com/openai/codex) installed and configured
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed and configured

### Install

```bash
npm install -g fight-for-me
```

### Basic Usage

```bash
# Start a debate
ffm "Your question here"

# 5-round debate
ffm "Compare ORMs for Node.js" -r 5

# Join as a participant
ffm "Microservices vs monolith?" -i

# Debate and apply code changes
ffm "Refactor this module" --plan

# Include files as context
ffm "How to improve this code?" --files src/index.ts src/utils.ts
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

## Commands

| Command | Description |
|---------|-------------|
| `ffm [question]` | Start a debate (default) |
| `ffm config` | View or update configuration |
| `ffm status` | Show current status and configuration |
| `ffm stop` | Stop running agent processes |
| `ffm model` | Configure AI models |

## REPL Commands

Inside the interactive REPL:

| Command | Description |
|---------|-------------|
| `/plan <topic>` | Debate & apply code changes |
| `/join <topic>` | Interactive 3-way debate (You + Codex + Claude). Alias: `/i` |
| `/rounds <n>` | Set number of debate rounds |
| `/judge <provider>` | Set judge: `codex`, `claude`, `both` |
| `/format <format>` | Output format: `pretty`, `json`, `markdown` |
| `/stream` | Toggle streaming output |
| `/files <paths...>` | Set context files (replaces current list) |
| `/context` | Toggle project context collection. Alias: `/nocontext` |
| `/model codex <name>` | Set Codex model (from known models list) |
| `/model claude <name>` | Set Claude model (from known models list) |
| `/model list` | Show currently configured models and known models |
| `/config` | Manage persistent configuration |
| `/status` | Check agent CLI status |
| `/stop` | Stop running fight-for-me processes |
| `/help` | Show help |
| `/exit` | Exit the REPL. Alias: `/quit` |

## Configuration

Default settings can be changed via `ffm config`:

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
