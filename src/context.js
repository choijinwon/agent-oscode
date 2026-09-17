// A deliberately conservative heuristic, not a provider tokenizer.
export function estimateTokens(value) {
  return Math.ceil(Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8') / 2);
}
export function clip(text, limit = 8000) {
  text = String(text);
  if (text.length <= limit) return text;
  const suffix = '\n[truncated; narrow the query or request a smaller line range]';
  return text.slice(0, Math.max(0, limit - suffix.length)) + suffix;
}
export function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, estimated: 0 };
}
export function addUsage(total, next) {
  for (const key of Object.keys(emptyUsage())) total[key] += next[key] || 0;
}
export function totalTokens(usage) { return usage.input + usage.output; }

// Drop complete historical turns, never break tool-call/result pairs.
// This is lossy local trimming, not an LLM-generated summary.
export function compact(session, keep = 2) {
  const remove = Math.max(0, session.turns.length - keep);
  if (!remove) return 0;
  const dropped = session.turns.splice(0, remove);
  session.archive ||= [];
  session.archive.push(...dropped);
  const notes = dropped.map(t => clip(t.messages[0]?.content || '', 240));
  session.omitted = (session.omitted || 0) + remove;
  session.memory = clip([session.memory || '', ...notes].filter(Boolean).join('\n'), 1600);
  return remove;
}
export function buildMessages(session) {
  const messages = session.turns.flatMap(t => t.messages);
  if (!session.omitted) return messages;
  return [{ role: 'user', content: `Historical turns were omitted to save tokens (${session.omitted}). These are user-request excerpts, NOT verified results. Re-read files when needed.\n${session.memory}` },
    { role: 'assistant', content: 'I will verify the current files rather than assume prior work succeeded.' }, ...messages];
}

// Preserve call/result pairing while evicting an old, large tool payload.
export function trimOldToolResult(turn, keepRecent = 2) {
  const results = turn.messages.map((message, index) => ({ message, index })).filter(x => x.message.role === 'tool');
  const candidate = results.slice(0, Math.max(0, results.length - keepRecent)).find(x => x.message.content.length > 400);
  if (!candidate) return false;
  turn.toolArchive ||= [];
  turn.toolArchive.push({ index: candidate.index, message: { ...candidate.message } });
  candidate.message.content = clip(candidate.message.content, 240) + '\n[older tool payload omitted from model context; original stored locally; re-read if needed]';
  return true;
}
