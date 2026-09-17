// Parse SSE across arbitrary UTF-8/network chunk boundaries.
export async function* events(body) {
  const decoder = new TextDecoder();
  let buffer = '', bytes = 0;
  for await (const chunk of body) {
    bytes += chunk.byteLength;
    if (bytes > 8 * 1024 * 1024) throw new Error('Provider response exceeded 8 MiB.');
    buffer += decoder.decode(chunk, { stream: true });
    let match;
    while ((match = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data) yield data;
    }
  }
  buffer += decoder.decode();
  if (buffer.trim()) throw new Error('Incomplete SSE frame; response may have been interrupted.');
}
export async function collectStream(kind, body, onText = () => {}) {
  const content = [], calls = new Map();
  let text = '', usage, finish, complete = false;
  for await (const raw of events(body)) {
    if (raw === '[DONE]') { complete = true; continue; }
    let event;
    try { event = JSON.parse(raw); } catch { throw new Error('Malformed provider stream.'); }
    if (event.error || event.type === 'error') throw new Error('Provider stream reported an error; no automatic retry was made.');
    if (kind === 'anthropic') {
      if (event.type === 'message_start') usage = event.message.usage;
      if (event.type === 'content_block_start') content[event.index] = { ...event.content_block, json: '' };
      if (event.type === 'content_block_delta') {
        const block = content[event.index];
        if (!block) throw new Error('Invalid streamed block index.');
        if (event.delta.type === 'text_delta') { block.text = (block.text || '') + event.delta.text; onText(event.delta.text); }
        if (event.delta.type === 'input_json_delta') block.json += event.delta.partial_json;
      }
      if (event.type === 'message_delta') { finish = event.delta.stop_reason; usage = { ...usage, ...event.usage }; }
      if (event.type === 'message_stop') complete = true;
    } else {
      if (event.usage) usage = event.usage;
      const choice = event.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;
      const delta = choice.delta || {};
      if (delta.content) { text += delta.content; onText(delta.content); }
      for (const call of delta.tool_calls || []) {
        const item = calls.get(call.index) || { id: '', type: 'function', function: { name: '', arguments: '' } };
        if (call.id) item.id = call.id;
        if (call.function?.name) item.function.name += call.function.name;
        if (call.function?.arguments) item.function.arguments += call.function.arguments;
        calls.set(call.index, item);
      }
    }
  }
  if (!complete || !finish) throw new Error('Provider stream ended before completion; partial tool calls were not executed.');
  if (kind === 'anthropic') return { content: content.filter(Boolean).map(b => {
    if (b.type === 'tool_use' && b.json) { try { b.input = JSON.parse(b.json); } catch { b.input = null; } }
    delete b.json; return b;
  }), usage, stop_reason: finish };
  return { choices: [{ message: { content: text, tool_calls: [...calls.values()] }, finish_reason: finish }], usage };
}
