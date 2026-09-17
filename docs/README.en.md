# oscode: a token-aware terminal AI coding agent

oscode is an open-source Node.js command-line coding assistant for Anthropic Claude and Chat Completions-compatible model APIs. It combines a small agent loop with bounded context, usage analytics, file checkpoints, and repeated-tool-call detection.

It is an independent implementation inspired by terminal coding workflows in OpenCode and Pi. It does not bundle those engines or Claude Code, and is not affiliated with their maintainers.

## Install and try the CLI

Requires Node.js 22 or later. Core agent features need no external packages; browser diagnostics use optional Playwright and Chromium.

```sh
git clone https://github.com/choijinwon/agent-oscode.git
cd agent-oscode
node bin/oscode.js --demo
node bin/oscode.js --help

# Optional local command installation
npm link
```

The offline demo lists real local project files without using an API key. oscode is installed from this repository; these instructions do not imply publication to the npm registry.

Set `ANTHROPIC_API_KEY` in your environment and choose a model available to your account:

```sh
node bin/oscode.js --model YOUR_MODEL_ID
node bin/oscode.js --model YOUR_MODEL_ID --plan --prompt 'Explain this project'
```

For a compatible model service, set `OSCODE_API_KEY` and use `--provider compatible`. The default compatible endpoint is OpenRouter. For a local server:

```sh
node bin/oscode.js --provider compatible --base-url http://localhost:1234/v1 --model YOUR_LOCAL_MODEL
```

The server/model must support tool calls and the implemented Chat Completions streaming contract. No credentials are required for localhost endpoints.

## Features

- Streaming terminal conversation and one-shot prompts.
- Project file listing, literal search, line-range reading, exact replacement, and new-file creation.
- Plan mode with saved implementation plans, interactive mode switching, explicit apply, permission prompts, shell timeout, and cancellation.
- Saved sessions with resume, context trimming, and archived original tool results.
- Per-turn token budgets and configurable input, output, and step limits.
- Per-request and per-model usage, cache accounting, context composition estimates, and optional price-based USD estimates.
- File checkpoints and conflict-aware undo that preserves pre-existing user edits.
- Detection of repeated identical tool results and consecutive tool failures.
- Project configuration, test-command settings, and a Git diff command.

## Project configuration

```sh
node bin/oscode.js --init
node bin/oscode.js --config
node bin/oscode.js --resume latest --usage
node bin/oscode.js --resume latest --checkpoints
node bin/oscode.js --resume latest --undo latest
```

Maintenance commands do not need model credentials. `oscode.json` can set `profile`, `provider`, `model`, `baseUrl`, `budget`, `maxInput`, `maxOutput`, `maxSteps`, `loopLimit`, `testCommand`, and `permissions`. CLI options override environment settings, which override project settings; profiles supply unspecified defaults. Project `deny` permissions and read-only mode remain enforced.

Optional `pricing` entries are keyed by provider and exact model ID, with `input`, `output`, `cacheRead`, and `cacheWrite` rates in USD per million tokens. Missing prices are reported as unpriced, never as zero. Prices are user-supplied estimates, not live billing data. See the [configuration reference](configuration.md).

## Plan before implementation

```sh
node bin/oscode.js --model YOUR_MODEL_ID --plan --prompt 'Plan a login refactor'
node bin/oscode.js --resume latest --show-plan
node bin/oscode.js --model YOUR_MODEL_ID --resume latest --apply-plan
```

In a conversation, `/plan` enters plan mode, `/plan TASK` investigates and drafts a plan, and `/plan show` displays it without a model call. `/apply` shows the latest plan and asks for confirmation before implementation. `/plan off` changes mode without executing the plan. Plans survive compaction and session resume. Existing project `plan: true` restrictions cannot be bypassed by apply.

The noninteractive `--apply-plan` flag explicitly authorizes starting the selected saved plan; it does not grant file or shell permissions. See the [plan-mode guide](planning.md).

## Interactive commands

`/help`, `/usage`, `/usage all`, `/compact`, `/model MODEL`, `/budget N`, `/diff`, `/checkpoints`, `/undo`, `/undo ID`, `/config`, `/test`, `/exit`.

The default economy profile allows an estimated 12,000 input tokens, 1,500 output tokens per request, 40,000 cumulative tokens per user turn, and 8 model calls. These values are configurable. No measured savings percentage is claimed.

## Limits and verification

Input estimates are heuristic; actual usage is taken from provider responses when available. Budgets are not guaranteed billing caps. Live-provider compatibility and real-model cost savings have not yet been benchmarked.

Undo covers one recorded file-tool edit or creation at a time. It refuses to overwrite later file-content or mode changes and does not reverse shell side effects. Shell commands run with your OS user permissions; this is not a sandbox.

Session data and before-edit file contents are stored in `.oscode/`. Keep this directory out of version control. API keys belong in environment variables, not project configuration.

```sh
npm test
npm run check
```

Tests include a local mock HTTP/SSE provider and do not require paid model calls. CI runs on Node.js 22 and 24.

[Architecture](architecture.md) · [Korean guide](../README.md) · [Report an issue](https://github.com/choijinwon/agent-oscode/issues) · [MIT license](../LICENSE)

## Frontend specialist

Use `oscode --agent frontend` for component, responsive layout and accessibility work. `--inspect-frontend` reports declared frameworks, package manager, available script names and bounded file samples without API calls or executing project scripts. Combine with `--plan`; approved plans retain their specialization. Switch with `/agent frontend|general`, or inspect a monorepo app with `/frontend apps/web`. Existing permissions and token limits apply. Use `oscode ui check URL` for Chromium viewport screenshots, overflow candidates and browser errors (optional Playwright + Chromium required). It is an initial-load diagnostic, not complete visual/accessibility validation.

## Frontend quality workflow

`ui check URL --scenario FILE --a11y` runs bounded saved steps and automated accessibility rules. Review PNGs before approving an immutable baseline using `--approve-baseline RUN_ID --baseline NAME`; compare with `ui check URL --baseline NAME`. Use `--tokens`, `--impact PATH`, and `--story PATH` for token candidates, AST reverse imports and React CSF stories. Story generation supports explicit state args and optional role/name visibility assertions. [Details and limits](frontend-quality.md). Optional dependencies are required for browser, AST and image analysis.
