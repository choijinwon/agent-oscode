# Full-screen console

Interactive sessions use a full-screen terminal UI by default. Run `oscode
--simple` for the previous line-oriented console. `--prompt`, `--demo`, piped
output and maintenance commands remain line-oriented. `--ui-preview` displays
a static illustrative preview, not the interactive full-screen session.

## Conversation and input

- The header shows project, panel, model and execution stage.
- The composer stays at the bottom; it starts with three visible rows and grows to eight rows (less in small terminals) and follows
  the editing cursor within longer input.
- Enter sends. Alt+Enter or Ctrl+J inserts a newline. Terminal mappings for
  Shift+Enter vary; use the documented keys instead.
- Bracketed paste preserves multiline text as one draft without sending it.
  Pasted slash commands are sent as prompt text, not executed as CLI commands.
  For terminals without bracketed paste, use `/paste` and `/send`.
- Left/right and up/down move within input; Home/End or Ctrl+A/E jump to the current line’s start/end.
- Input is bounded to 64 KiB. Additional input is rejected with an inline hint.
- You can edit an unsent draft while the agent works. It is not submitted until
  the current operation finishes and you press Enter again.

## Scroll and menus

- PageUp/PageDown scroll conversation history independently of input.
- At the bottom, new output is followed automatically. When reading older text,
  the viewport stays in place and `최신 답변 ↓` appears.
- Ctrl+End returns to the latest output. Scrolling uses the keyboard; no mouse
  capture is enabled, so terminal text selection remains available.
- Type `/` and press Tab for command choices. Up/down or Tab selects a command; Enter inserts
  it and another Enter runs it.
- F2 expands or collapses tool output collectively. Summaries remain visible
  while collapsed. Full execution data is retained in the normal local session.

## Work, review and settings

Actual tool events update the stage: analysis, modification, or verification /
execution, with the current path/tool. These labels describe the operation and
are not independent correctness judgments.

File edits and creation show a before/after replacement preview (`-`/`+`) before
normal approval. Scroll to inspect it, then enter `y` to apply or `n` to cancel.
The preview is bounded and explicitly marks omitted lines; it is not an
exportable unified patch. Existing stale-file protection and project permissions
remain in force. Explicit `--yes` / `--allow-shell` retain their automatic approval
behavior. `/diff` shows the repository diff; `/undo` keeps its existing scope.

The token bar shows the current/last turn's input+output, configured turn budget,
remaining amount and a separate draft-input estimate. Unknown usage estimates
are labeled. The remaining display is informational, not a billing guarantee;
the agent still enforces its own request reservations.

`/settings` opens a summary and sequential provider, URL and model fields in the
settings panel. `/key` opens a masked prompt; the secret is excluded from the
screen transcript, logs and history. Cancelled settings restore any unsent draft.
Settings choices apply to this chat; saved credentials use the existing separate
user credential store.

Ctrl+C cancels an active operation; while idle it closes the console. Exit
restores the terminal screen, cursor, paste mode and prior raw-input state.
The UI retains up to 250 display entries / about 300k characters in memory; older
items may leave the screen buffer while normal session storage remains separate.
ANSI terminal support is required. Use `--simple` for limited terminals or screen
readers, and `NO_COLOR=1` to disable colors.

## File references and context selection

Use `@src/Button.vue` in a prompt, or `@"src/my component.vue"` for spaces.
The full-screen console suggests project file names after pressing Tab on an `@` reference;
Tab/up/down selects, Enter inserts, and a second Enter sends. Suggestions refresh
between turns and inherit the bounded file listing (up to 3,000 files). `--simple`
accepts references without file completion.

- `/context add src/Button.vue` pins a file for future requests.
- `/context remove src/Button.vue` removes that future attachment.
- `/context clear` removes all pinned files.
- `/context` shows pinned files and estimated source/conversation tokens.
- `/context history off` excludes past turns, their compacted excerpts and analysis
  checkpoints from subsequent model requests; `/context history on` restores them.

Each request freshly reads up to eight explicitly selected/referenced files, with
at most 2,000 characters per file. Truncation is labeled. Imports are not
implicitly attached; the agent can request dependencies through its existing
bounded tools. Invalid, secret, binary, oversized or outside-project paths stop
submission. File excerpts are data, not instructions, and do not count as the
read evidence needed to edit. The existing request budget includes attachments.

Removing files does not erase previous messages. History exclusion is not a
file-access restriction: the agent can still read project files using tools.
The panel estimates omit system instructions, tool definitions and future results;
they are not a provider bill. Pinned files are local to the active chat process;
the history toggle is saved with the session. Source excerpts remain in local
session records like ordinary prompts.

## Diagnose and repair

`/diagnose lint` runs the named package script with normal shell approval and
writes the existing local verification report. `/diagnose` uses configured
verification scripts, or detected typecheck/lint scripts. This flow deliberately
runs scripts only, without starting a browser or development server.

After a script failure, `/fix` sends bounded diagnostics to the configured model,
asks for a targeted fix through normal approved tools, then reruns the same
script selection once if the model turn completes. Each execution still requires
approval unless explicitly enabled with `--allow-shell`. PLAN blocks this flow.
No key is needed for diagnosis; model-driven repair requires a configured model.
Blocked, cancelled and timed-out checks are not offered as fixable code errors.
The new report is the result; model completion alone does not mean the fix passed.
There is no automatic retry loop or guarantee that the model finds the cause.

## Input convenience shortcuts

- **Ctrl+R** searches submitted input from this running console. Type Korean or
  other text to filter, use up/down to select, and Enter to load it into the
  composer. A second Enter submits it. Multiline paste retains its prompt-only
  behavior when recalled. History holds at most 100 unique entries / 200k
  characters in memory; it is not imported from previous sessions. Hidden key
  prompts, model-setting responses and approval answers never enter this history.
- **Ctrl+P** opens the command palette. Search by Korean description or slash
  command (for example `모델 설정` or `/settings`). Enter loads the command without
  running it. Esc or Ctrl+C closes either search and restores the original draft
  and editing cursor. Search is disabled during key entry and approval prompts.
- **Ctrl+C during a model operation** cancels the work and restores its request
  when the composer is empty. If a newer draft exists, it stays intact; clear the
  draft and press **F4** to retrieve the cancelled request. Recovery holds one
  request in memory, does not undo already-applied changes and does not resend
  anything automatically. Ctrl+C while idle retains its existing exit behavior.
- The footer changes to show relevant controls for chat, search, settings,
  hidden key entry, approval and running work.

These conveniences are available in the default full-screen console. They add
no model calls. Input composed by an operating-system IME depends on the terminal;
this feature does not implement or claim control of IME composition events.


## Long-form input

F3 toggles multiline composition for this running console. In multiline mode,
Enter inserts a newline and F5 sends. In normal mode Enter sends and Ctrl+J or
Alt+Enter inserts a newline. Settings and approvals keep Enter to confirm.
The composer shows the current visual line and total visual lines; its viewport
follows the cursor when the input exceeds eight visible rows. Small terminals
reserve space for conversation and controls and show fewer input rows.

Ctrl+A/E move to the logical line start/end, Ctrl+U removes text to line start,
Ctrl+K removes text to line end (or the following newline at line end), and Ctrl+W
removes the preceding whitespace-delimited word. Text after the cursor is kept.
Completion is opened explicitly with Tab; arrows edit the input until then.
Esc closes completion. Only changed screen rows are repainted to reduce output
and flicker while editing. Operating-system IME behavior is still terminal-owned.

The composer uses a rounded border capped at 100 terminal cells, with a placeholder
when empty and a visual line counter at the bottom for multiline drafts. Token
status hides zero-use and zero-draft counters and formats numbers with separators.
Muted status/help and an accent border distinguish input from conversation.

On an empty session, a compact start panel groups the project, frontend quick
commands and composer in the center of the terminal. After the first conversation
entry, the layout uses the available height and keeps recent short conversations
immediately above the composer. Header, wrapped conversation and input share the
same centered column (at most 100 cells); narrow terminals use their full width.

## Model selection in settings

After provider and API URL confirmation, `/settings` fetches that endpoint's
`/models` catalog (10-second timeout; no generation request). In the full-screen
console, type to filter model IDs, use arrows to choose and Enter to confirm.
The current model is an option only for the same provider and URL. Choose
`직접 입력` for models absent from the catalog or when discovery is unavailable.
`--simple` prints a numbered list and also accepts an explicit model ID.

Discovery uses the same stored/environment credentials as model requests and
rejects redirects. Lists are bounded to 1,000 IDs / 4 MB; pagination beyond the
returned page is not automatically fetched. Listing does not guarantee tool-call
support, account access or available quota. Ctrl+C cancels without committing
partial changes. Settings still apply to the current chat process.

Catalog formats: [Claude Models API](https://platform.claude.com/docs/en/api/models)
and [OpenRouter Models API](https://openrouter.ai/docs/api/api-reference/models/get-models).
