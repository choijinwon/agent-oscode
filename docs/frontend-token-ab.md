# Frontend context and A/B comparison

Frontend mode defaults to `--context-mode focused`. The agent is guided to use
`frontend_context` for a specific component before expanding its search. It reads
literal relative imports, adjacent styles, Vue/Svelte scripts, and Angular
`templateUrl`, `styleUrl`, and `styleUrls`. Existing imported components and tokens
are available for reuse. This is a bounded heuristic, not full framework compilation:
package aliases, dynamic imports and transitive dependencies require further reads.
No model call is required to prepare context. Source must be read through the normal
file tool before editing, so existing stale-file protection remains active.

```sh
oscode --agent frontend --prompt 'src/components/Card.vue의 버튼 상태를 개선해줘'
oscode --frontend-context src/components/Card.vue
# Previous tool selection and shell output behavior
oscode --agent frontend --context-mode standard --prompt '같은 작업'
```

Focused mode shortens long shell results before the next model call. Duplicate
lines are removed and diagnostic lines are prioritized. The original **bounded tool
result** remains in the session's `toolArchive`; the error flag remains unchanged.
This is lossy and does not replace verification. Existing local `verify` reports
retain the separate verification outcome. No new shell execution permissions are granted.

## Offline input comparison (no API charge)

```sh
oscode --ab-context src/components/Card.vue --prompt '이 컴포넌트 개선 계획'
```

A contains a broad, bounded source snapshot; B contains the target and its direct
dependencies. Both use the same snapshot fingerprint, system prompt and task.
The scan is limited to 100 source files, 24,000 characters per file and 120,000
characters overall. B is clipped to 16,000 characters. The agent tool is additionally
bounded by its configured output limit. Files and source bodies are not included
in the saved report; the report records the fingerprint and metrics.

The byte-based input estimates are **not real provider token counts**, and this
comparison is not a replay of the previous agent implementation. A small snapshot
may show no savings. It does not measure implementation success.

## Optional live response comparison (two model calls)

```sh
oscode --ab-context src/components/Card.vue --ab-live \
  --model YOUR_MODEL_ID --prompt '이 컴포넌트 개선 계획' \
  --max-input 80000 --budget 180000 --max-output 1500
```

Use limits appropriate to the actual project and model. The CLI checks both input
estimates and the combined pair reservation before calling the API. The two arms
run sequentially in random order, with the same model/output limit and no tools:
**they neither edit code nor run tests**. On a request failure with unknown charges,
the remaining arm is not sent. Cancellation and budget stops are recorded.

Reports are saved to `.oscode/ab-<id>.json` (ignored by Git) and printed as JSON:
input estimates, reported input/output/cache usage, estimated-usage flags,
response duration, answers, truncation/failure status, and token differences.
An API failure may leave usage unknown. Live answers may contain source excerpts;
keep the reports private. Provider caching and nondeterminism can affect results.

`quality: not-evaluated` is intentional. Review both answers against the same
acceptance criteria; a short or truncated answer is not automatically better.
Repeat paired tasks across representative components before drawing conclusions.
This first experiment compares read-only analysis responses, not end-to-end
coding success, retries or test pass rates. Use existing `verify` reports to
validate implementations separately.
