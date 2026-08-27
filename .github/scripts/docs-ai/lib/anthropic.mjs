import Anthropic from '@anthropic-ai/sdk';

let client = null;

function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    client = new Anthropic({apiKey});
  }
  return client;
}

/**
 * One-shot completion. Returns the assistant's full text output.
 *
 * `system` accepts either a string or an array of pre-built blocks. A plain
 * string is wrapped in a single cached block; pass an array when you want
 * cache boundaries you control (see reviewSystemBlocks in personas.mjs).
 */
export async function complete({model, system, user, maxTokens = 4096, temperature = 0.2}) {
  const systemBlocks = Array.isArray(system)
    ? system
    : [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}];

  const res = await withRetry(() =>
    getClient().messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemBlocks,
      messages: [{role: 'user', content: user}],
    }),
  );

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return {text, usage: res.usage, stopReason: res.stop_reason};
}

/** Parse JSON out of a model response, even when it's wrapped in a fence. */
export function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    // Last resort: the first balanced-looking object or array in the output.
    const m = candidate.match(/[{[][\s\S]*[}\]]/);
    if (m) return JSON.parse(m[0]);
    throw new Error(`Could not parse JSON from model output: ${text.slice(0, 200)}…`);
  }
}

export function usageLine(usage) {
  const cached = usage.cache_read_input_tokens ?? 0;
  return `in=${usage.input_tokens} out=${usage.output_tokens} cached=${cached}`;
}

async function withRetry(fn, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const transient = e.status === 429 || e.status === 529 || (e.status >= 500 && e.status <= 599);
      if (!transient || i === attempts - 1) throw e;
      const backoff = 2 ** i * 1000 + Math.random() * 500;
      console.warn(`[anthropic] transient ${e.status}; retry in ${Math.round(backoff)}ms`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}
