# Long analysis checkpoints

During long analysis, the agent can call `analysis_checkpoint` after `read_file`
to save a concise interpretation, an exact visible source quote, and a next
question. This writes session metadata only, including in plan mode; it does not
change project source or grant shell permissions.

```sh
oscode --agent frontend --plan --prompt '로그인 버튼이 비활성화되는 원인을 분석하고 근거와 다음 질문을 체크포인트에 남겨줘'
oscode --analysis-notes
oscode --resume latest --agent frontend --plan --prompt '저장된 분석 근거를 확인하고 이어서 분석해줘'
```

Use `--resume SESSION_ID --analysis-notes` for a specific saved session.
The latest four notes survive conversation compaction and session reloads.
Before each model request, OSCODE compares the full source-file hash with the
saved hash. Changed, missing or disallowed files invalidate the saved conclusion:
only the unresolved question and a re-read warning are supplied. Unchanged source
does **not** prove the interpretation correct, and notes are labeled accordingly.
Evidence from another file must be saved separately; a note does not validate an
entire dependency graph, runtime behavior or external state.

Each note is limited to a 500-character summary, 200-character quote and
300-character question. The injected notes are bounded to 3,200 characters.
The model must actually request a checkpoint; a long analysis does not guarantee
that it will do so. Saving a note consumes an ordinary tool interaction, and
source hash checks run locally without an additional model call.

Repeated `read_file` outputs of at least 400 characters are replaced with a
reference only when the exact original output remains in the active conversation.
Changed content, compacted/trimmed results, and planning turns excluded during
plan application are not eligible. Original bounded results remain in the local
session archive. If an earlier result is subsequently omitted, the reference
instructs the model to read again. This reduces repeated payload transmission,
not local disk reads. Existing loop guards still stop repeated identical calls.

Notes and source excerpts are stored under `.oscode`, which is ignored by Git.
Normal input, total-token and step budgets still apply. Savings depend on task
length and reuse; no fixed saving percentage or automatic correctness guarantee
is claimed. New progress detection across different searches is not implemented;
the existing repeated-call and consecutive-failure guard remains in effect.
