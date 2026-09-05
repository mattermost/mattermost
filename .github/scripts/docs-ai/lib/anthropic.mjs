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

export async function complete({model, system, userPrompt, maxTokens = 4096, temperature = 0.2}) {
  const systemBlocks = Array.isArray(system)
    ? system
    : [{type: 'text', text: system, cache_control: {type: 'ephemeral'}}];

  const res = await withRetry(() =>
    getClient().messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      system: systemBlocks,
      messages: [{role: 'user', content: userPrompt}],
    }),
  );

  const text = res.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  return {text, usage: res.usage, stopReason: res.stop_reason};
}

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function withRetry(fn, {attempts = 3, wait = sleep} = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const status = e?.status;
      const transient = status === 429 || status === 529 || (status >= 500 && status <= 599);
      if (!transient || i === attempts - 1) throw e;
      const backoff = 2 ** i * 1000 + Math.random() * 500;
      console.warn(`[anthropic] transient ${status}; retry in ${Math.round(backoff)}ms`);
      await wait(backoff);
    }
  }
  throw lastErr;
}
