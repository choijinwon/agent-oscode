import { createCodexProvider } from './codex-provider.js';
import { getCredential } from './credentials.js';
import { estimateTokens } from './context.js';
import { collectStream } from './stream.js';

export function endpoint(base, route) {
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash) throw new Error('Base URL must not contain credentials, query, or fragment.');
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
    throw new Error('Use HTTPS, or HTTP on localhost for a local model.');
  }
  return `${url.href.replace(/\/$/, '')}/${route}`;
}
function anthropicMessages(messages) {
  const output = [];
  for (const m of messages) {
    let item;
    if (m.role === 'tool') item = { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content, is_error: Boolean(m.is_error) }] };
    else if (m.role === 'assistant') item = { role: 'assistant', content: [
      ...(m.content ? [{ type: 'text', text: m.content }] : []),
      ...(m.tool_calls || []).map(t => ({ type: 'tool_use', id: t.id, name: t.name, input: t.input }))
    ] };
    else item = { role: 'user', content: [{ type: 'text', text: m.content }] };
    if (output.at(-1)?.role === item.role) output.at(-1).content.push(...item.content);
    else output.push(item);
  }
  return output;
}
export function makeBody(kind, request) {
  const { model, system, messages, tools, maxOutput } = request;
  if (kind === 'anthropic') {
    const mapped = anthropicMessages(messages);
    const last = mapped.at(-1)?.content.at(-1);
    if (last) last.cache_control = { type: 'ephemeral' };
    return { model, max_tokens: maxOutput,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: mapped,
      tools: tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters })) };
  }
  return { model, max_tokens: maxOutput, messages: [{ role: 'system', content: system }, ...messages.map(m => {
    if (m.role === 'tool') return { role: 'tool', tool_call_id: m.tool_call_id, content: m.content };
    return { role: m.role, content: m.content || null, ...(m.tool_calls?.length ? { tool_calls: m.tool_calls.map(t => ({ id: t.id, type: 'function', function: { name: t.name, arguments: JSON.stringify(t.input) } })) } : {}) };
  })], tools: tools.map(t => ({ type: 'function', function: t })) };
}
export function parseResponse(kind, data, request) {
  let content, calls, truncated, usage;
  if (kind === 'anthropic') {
    if (!Array.isArray(data.content)) throw new Error('Invalid Anthropic response.');
    content = data.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    calls = data.content.filter(b => b.type === 'tool_use').map(b => ({ id: b.id, name: b.name, input: b.input }));
    truncated = data.stop_reason === 'max_tokens';
    const u = data.usage;
    if (u && Number.isFinite(u.input_tokens) && Number.isFinite(u.output_tokens)) usage = { input: u.input_tokens + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0), output: u.output_tokens, cacheRead: u.cache_read_input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, requests: 1, estimated: 0 };
  } else {
    const choice = data.choices?.[0];
    if (!choice?.message) throw new Error('Invalid compatible API response.');
    content = choice.message.content || '';
    calls = (choice.message.tool_calls || []).map(t => {
      let input;
      try { input = JSON.parse(t.function.arguments); } catch { input = null; }
      return { id: t.id, name: t.function.name, input };
    });
    truncated = choice.finish_reason === 'length';
    const u = data.usage;
    if (u && Number.isFinite(u.prompt_tokens) && Number.isFinite(u.completion_tokens)) usage = { input: u.prompt_tokens, output: u.completion_tokens, cacheRead: u.prompt_tokens_details?.cached_tokens || 0, cacheWrite: 0, requests: 1, estimated: 0 };
  }
  if (calls.length > 16) throw new Error('Too many tool calls in a single response (maximum 16).');
  const seen = new Set();
  if (calls.some(t => typeof t.id !== 'string' || !t.id || seen.has(t.id) || !seen.add(t.id) || typeof t.name !== 'string')) throw new Error('Invalid or duplicate tool-call ID.');
  usage ||= { input: estimateTokens(makeBody(kind, request)), output: estimateTokens({ content, calls }), cacheRead: 0, cacheWrite: 0, requests: 1, estimated: 1 };
  return { content, calls, truncated, usage };
}
export function createProvider(config, fetchImpl = fetch) {
  if (config.provider === 'chatgpt') return createCodexProvider();
  if (config.provider === 'demo') return demoProvider();
  const kind = config.provider;
  if (!['anthropic', 'compatible'].includes(kind)) throw new Error('Provider must be anthropic, compatible, or demo.');
  const base = config.baseUrl || (kind === 'anthropic' ? 'https://api.anthropic.com/v1' : 'https://openrouter.ai/api/v1');
  const url = endpoint(base, kind === 'anthropic' ? 'messages' : 'chat/completions');
  const key = (kind === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OSCODE_API_KEY) || getCredential(kind, base);
  if (!key && !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) throw new Error(`Set ${kind === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OSCODE_API_KEY'} or use oscode auth set --provider ${kind}.`);
  return { async complete(request, signal, onText) {
    const headers = { 'content-type': 'application/json' };
    if (kind === 'anthropic') { headers['anthropic-version'] = '2023-06-01'; if (key) headers['x-api-key'] = key; }
    else if (key) headers.authorization = `Bearer ${key}`;
    const response = await fetchImpl(url, { method: 'POST', headers, redirect: 'error', body: JSON.stringify({ ...makeBody(kind, request), stream: true, ...(kind === 'compatible' ? { stream_options: { include_usage: true } } : {}) }), signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]) });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`API HTTP ${response.status}; check model, credentials, endpoint, and provider quota. No automatic retry was made.`); }
    const streamed = response.headers.get('content-type')?.includes('text/event-stream');
    const data = streamed ? await collectStream(kind, response.body, onText) : await response.json();
    return { ...parseResponse(kind, data, request), streamed };
  } };
}
function demoProvider() {
  return { async complete(request) {
    const last = request.messages.at(-1);
    const result = last?.role === 'tool'
      ? { content: '오프라인 데모 완료. 위 파일 목록은 실제 작업 폴더에서 읽었습니다. 실제 코딩에는 모델과 API 키를 설정하세요.', calls: [] }
      : { content: '오프라인 데모: 프로젝트 파일 목록을 확인합니다.', calls: [{ id: `demo_${request.messages.length}`, name: 'list_files', input: { path: '.' } }] };
    return { ...result, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0, estimated: 0 } };
  } };
}
