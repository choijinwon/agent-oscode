# Full-screen console

Interactive sessions use a full-screen terminal UI by default. Run `oscode
--simple` for the previous line-oriented console. `--prompt`, `--demo`, piped
output and maintenance commands remain line-oriented. `--ui-preview` displays
a static illustrative preview, not the interactive full-screen session.

## Conversation and input

- The header shows project, panel, model and execution stage.
- The composer stays at the bottom; it grows to four visible rows and follows
  the editing cursor within longer input.
- Enter sends. Alt+Enter or Ctrl+J inserts a newline. Terminal mappings for
  Shift+Enter vary; use the documented keys instead.
- Bracketed paste preserves multiline text as one draft without sending it.
  Pasted slash commands are sent as prompt text, not executed as CLI commands.
  For terminals without bracketed paste, use `/paste` and `/send`.
- Left/right and up/down move within input; Home/End jump to its start/end.
- Input is bounded to 64 KiB. Additional input is rejected with an inline hint.
- You can edit an unsent draft while the agent works. It is not submitted until
  the current operation finishes and you press Enter again.

## Scroll and menus

- PageUp/PageDown scroll conversation history independently of input.
- At the bottom, new output is followed automatically. When reading older text,
  the viewport stays in place and `최신 답변 ↓` appears.
- Ctrl+End returns to the latest output. Scrolling uses the keyboard; no mouse
  capture is enabled, so terminal text selection remains available.
- Type `/` for command choices. Up/down or Tab selects a command; Enter inserts
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
