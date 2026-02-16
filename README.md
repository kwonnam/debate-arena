# fight-for-me

AI Debate CLI - Codex vs Claude multi-round debates via local CLIs.

Two AI agents argue about your question, then synthesize a consensus. Optionally apply the conclusion directly to your codebase.

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

# Apply the debate conclusion to your codebase
ffm "Add input validation to the user form" --apply

# Apply with a specific agent
ffm "Add error handling to API calls" --apply claude

# Apply with both agents (Codex implements, Claude verifies)
ffm "Implement caching layer" --plan --apply both

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
| `ffm model` | Configure AI models |

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-r, --rounds <n>` | Number of debate rounds | `3` |
| `-j, --judge <provider>` | Judge for synthesis: `codex`, `claude`, `both` | `claude` |
| `-f, --format <format>` | Output format: `pretty`, `json`, `markdown` | `pretty` |
| `-a, --apply [provider]` | Apply conclusions: `codex`, `claude`, `both` | - |
| `--plan` | Use implementation planning mode | `false` |
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

## How It Works

1. Your question is sent to both Codex and Claude
2. Each agent responds with their perspective
3. They debate back and forth for the specified number of rounds
4. A judge (default: Claude) synthesizes the debate into a final consensus
5. Optionally, the conclusion is applied to your codebase by the selected agent

## License

MIT
