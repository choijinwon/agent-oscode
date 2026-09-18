# ChatGPT account connection

OSCODE supports a `chatgpt` provider through the official Codex App Server.
The npm package includes pinned `@openai/codex@0.155.0`; no global Codex command
is required. Platform-native optional packages must be installed by npm.

## Connect

1. Restart OSCODE and open `/settings` in the full-screen console.
2. Select **ChatGPT 계정으로 로그인**.
3. Complete the official browser sign-in and return to the terminal.
4. Select an available model and choose **적용하고 닫기**.

If the browser does not open, the settings panel shows the official sign-in URL.
Ctrl+C cancels. Existing ChatGPT authentication is reused. The model list comes
from App Server `model/list`; no model names are hard-coded.

Codex manages credentials under `~/.oscode/codex`, separate from the user's usual
`~/.codex` profile. OSCODE does not read, copy, display or store raw ChatGPT tokens
in its own API-key store. Environment API keys are not forwarded to this runtime.
Login is persisted by Codex immediately, even if the settings draft is cancelled.
`ChatGPT 연결 해제 (즉시)` logs out of this isolated profile immediately; cancelling
settings does not undo logout. Applied provider/model choices still last for the
current OSCODE process, as with other settings. To select the provider on future
runs, use `oscode --provider chatgpt --model YOUR_MODEL_ID` after signing in.

## Coding behavior

The ChatGPT adapter is a structured model bridge: each OSCODE model request starts
an ephemeral Codex thread in an empty temporary directory. The model receives the
OSCODE conversation and tool schemas and returns a constrained JSON answer or
proposed OSCODE tool calls. OSCODE validates and executes those calls through its
existing tool runner. PLAN filtering, file permissions, stale-file checks,
approval, checkpoints and loop guards continue to apply. Native tool requests
from App Server are rejected; native shell, browser, apps, hooks and agent
features are disabled. Codex uses a read-only policy with read roots restricted
to its empty directory. User project contents enter through OSCODE's bounded
context and file tools. Existing explicit shell approval remains applicable.

Answers are displayed after the structured response validates, rather than
streaming raw JSON. Long responses may therefore take time before text appears.
Authentication and model-list failures leave source files untouched. Cancellation
interrupts the turn when possible, then closes the subprocess.

## Usage and limits

This is ChatGPT-authenticated Codex access, not a conversion to a general OpenAI
API key. Account entitlement and availability are determined by OpenAI.
App Server token usage is recorded when supplied; otherwise OSCODE marks its
estimates. Existing input estimates, turn reservations and step limits still
control whether another request/tool execution is allowed.

**The output target is not a hard server-side limit in this adapter.** App Server
may produce more output than `--max-output` or exceed a reservation. When the
reported/estimated output exceeds that target, OSCODE records usage and discards
all proposed tool calls from that response. No automatic retry occurs. Native
Codex framing also adds overhead beyond OSCODE's input estimate. Token settings
are not a guarantee of ChatGPT billing or quota consumption. Increase the output
target deliberately when a legitimate structured response needs more space.

Validation uses a real isolated App Server handshake and mocked account/model
responses; automated tests do not sign into a real user account or spend their
subscription credits. End-to-end live generation must be checked after the user
signs in. Protocol changes require updating and retesting the pinned runtime.

Sources: [OpenAI authentication](https://learn.chatgpt.com/docs/auth),
[Codex App Server](https://learn.chatgpt.com/docs/app-server).
