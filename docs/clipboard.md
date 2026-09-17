# Copy and paste

In the interactive CLI:

- `/copy`: copy the last completed assistant answer, including Markdown.
- `/copy code`: copy fenced triple-backtick code blocks from that answer, separated by blank lines.
- `/paste`: read the system clipboard into a local draft. Multiline code, blank lines and indentation are preserved. No model request is made yet.
- `/draft`: display the draft.
- `/send`: send the draft as one user message. Leading slash commands inside the draft are treated as prompt text, not CLI commands.
- `/clear`: discard the draft without changing the clipboard.

`/paste` reports line count and an input-token estimate. An existing draft must be
sent or cleared before replacement. Drafts are memory-only until sent and are
lost when the CLI exits. Normal model input/budget limits apply at send time.
Clipboard text is limited to 1 MiB. Avoid pasting secrets: `/send` passes the text
to the configured model and stores the turn in the local session.

```sh
# Copy an existing session's last completed answer without calling a model
oscode --copy-last
oscode --resume SESSION_ID --copy-last
```

Platform utilities: macOS `pbcopy`/`pbpaste`; Linux Wayland `wl-copy`/`wl-paste`,
or X11 `xclip`/`xsel`; Windows PowerShell. Missing utilities produce an actionable
error; OSCODE does not install them automatically. SSH/headless environments need
an available desktop clipboard connection. OSC 52 terminal clipboard access is
not used. Text is passed through stdin without shell interpolation.

Use `/paste` for multiline clipboard content. Direct terminal keyboard paste
still follows the terminal/readline behavior; this feature does not replace the
terminal's input editor or implement bracketed-paste interception.
