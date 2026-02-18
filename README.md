# fight-for-me

[한국어](./README.KR.md)

AI Debate CLI - Codex vs Claude multi-round debates via local CLIs.

Two AI agents argue about your question, then synthesize a consensus.
Join the debate yourself with interactive mode for a 3-way discussion.

## Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Codex CLI](https://github.com/openai/codex) installed and configured
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-cli) installed and configured

## Installation

```bash
npm install -g fight-for-me
```

## Usage

```bash
# Ask a question (interactive prompt if omitted)
ffm "Should we use REST or GraphQL for our new API?"

# Specify number of debate rounds
ffm "Best state management for React?" -r 5

# Use implementation planning mode
ffm "How should we refactor the auth module?" --plan

# Join the debate as a third participant
ffm "Best state management for React?" -i

# Disable streaming output
ffm "Compare ORMs for Node.js" --no-stream

# Output as JSON or Markdown
ffm "Best testing strategy?" -f json
ffm "Best testing strategy?" -f markdown

# Include specific files as context
ffm "How to improve this code?" --files src/index.ts src/utils.ts

# Skip project context collection
ffm "General JS question" --no-context
```

## Commands

| Command | Description |
|---------|-------------|
| `ffm [question]` | Start a debate (default command) |
| `ffm config` | View or update configuration |
| `ffm status` | Show current status and configuration |
| `ffm stop` | Stop running agent processes |
| `ffm model` | Configure AI models (dynamic fetching from API) |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --rounds <n>` | Number of debate rounds | `3` |
| `-j, --judge <provider>` | Judge for synthesis: `codex`, `claude`, `both` | `claude` |
| `-f, --format <format>` | Output format: `pretty`, `json`, `markdown` | `pretty` |
| `--plan` | Use implementation planning mode | `false` |
| `-i, --interactive` | Join the debate as a third participant | `false` |
| `--no-stream` | Disable streaming output | - |
| `--no-synthesis` | Skip final synthesis | - |
| `--no-context` | Disable project context collection | - |
| `--files <paths...>` | Include specific files in context | - |

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
| `applyTimeoutMs` | Apply command timeout (ms) | `300000` |

## REPL Commands

In the interactive REPL, you can use these slash commands:

| Command | Description |
|---------|-------------|
| `/plan <topic>` | Plan mode (debate then propose implementation) |
| `/i <topic>` | Interactive 3-way debate (You + Codex + Claude) |
| `/model codex` | Select Codex model (fetched from OpenAI API) |
| `/model claude` | Select Claude model (fetched from Anthropic API) |
| `/model list` | Show currently configured models |
| `/model refresh` | Clear model cache and re-fetch from APIs |
| `/rounds <n>` | Set number of debate rounds |
| `/judge <provider>` | Set judge: codex, claude, both |
| `/format <format>` | Output format: pretty, json, markdown |
| `/config` | Manage persistent configuration |
| `/help` | Show help |
| `/exit` | Exit the REPL |

### Dynamic Model Fetching

The `/model` command dynamically fetches available models from each provider's API:

- **Codex**: Uses OpenAI `models.list()` API (requires `OPENAI_API_KEY`)
- **Claude**: Uses Anthropic `GET /v1/models` API (requires `ANTHROPIC_API_KEY`)
- Results are cached in-memory for 5 minutes
- Falls back to a built-in list if API keys are missing or requests fail
- Use `/model refresh` to clear the cache and force re-fetch

## How It Works

1. Your question is sent to both Codex and Claude
2. Each agent responds with their perspective
3. They debate back and forth for the specified number of rounds
4. A judge (default: Claude) synthesizes the debate into a final consensus

In **plan mode** (`--plan` or `/plan`), after synthesis you can choose to apply the conclusion directly to your codebase.

In **interactive mode** (`-i` or `/i`), you join as a third participant — after each round, you can add your own perspective, steer the discussion, or challenge the agents before the next round begins.

## License

MIT
