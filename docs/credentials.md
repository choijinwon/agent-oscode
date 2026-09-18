# Model key settings

Start without an API key in local mode:

```sh
npx @choijinwon/oscode@latest
```

Save a Claude key through a hidden terminal prompt:

```sh
npx @choijinwon/oscode@latest auth set
```

For a compatible provider, bind the key to its API base URL:

```sh
npx @choijinwon/oscode@latest auth set --provider compatible --base-url https://openrouter.ai/api/v1
npx @choijinwon/oscode@latest --provider compatible --base-url https://openrouter.ai/api/v1 --model YOUR_MODEL_ID
```

Keys are stored in the user's `~/.oscode/credentials.json`, separately from
project configuration, Git and conversation history. This is a **plaintext local
file**, not an encrypted OS keychain. On POSIX systems it uses owner-only mode
600; the new parent directory uses 700. Windows filesystem ACLs determine access.
OSCODE rejects symlink credential files/directories and insecure POSIX file modes.
Never commit, share or paste this file into a model conversation.

`auth status` reports presence only; `auth remove` deletes the saved key for the
selected provider and base URL. Environment variables `ANTHROPIC_API_KEY` and
`OSCODE_API_KEY` take precedence. Stored keys are never put in `--config` output.
Changing endpoints does not reuse a saved key from another endpoint.

Automation may pipe a secret directly to `auth set --key-stdin` from a secret
manager. Avoid putting the literal key in shell command arguments or history.
Without this explicit flag, noninteractive key entry is rejected.

Models can still be configured through `oscode.json` (`model`, `provider`,
`baseUrl`) or CLI flags. API keys must not go in `oscode.json`. In an already-open
CLI, run `auth set` in another terminal, then use `/model MODEL`; the next model
request reloads the key. `/connect` shows setup guidance. Local compatible servers
can continue to work without keys.
