import { LlmChat, UserMessage, validateApiKey } from 'emergentintegrations';

// Multi-provider abstraction over a unified LLM proxy key with per-model fallback.
export const PROVIDERS = {
  openai: { label: 'OpenAI GPT-4o', model: 'gpt-4o' },
  anthropic: { label: 'Anthropic Claude Sonnet 4.5', model: 'claude-sonnet-4-5-20250929' },
  gemini: { label: 'Google Gemini 2.5 Flash', model: 'gemini-2.5-flash' },
};

export function resolveProvider(provider) {
  const p = PROVIDERS[provider] ? provider : 'openai';
  return { provider: p, model: PROVIDERS[p].model };
}

// Ordered fallback list so a single provider failure never breaks the product.
const FALLBACK_ORDER = ['openai', 'anthropic', 'gemini'];

export async function ask({ provider = 'openai', sessionId, systemMessage, prompt, history = [], temperature = 0.4, maxTokens = 2000 }) {
  const key = validateApiKey(process.env.EMERGENT_LLM_KEY);
  const preferred = resolveProvider(provider).provider;
  const order = [preferred, ...FALLBACK_ORDER.filter((p) => p !== preferred)];
  let lastErr;
  for (const p of order) {
    try {
      const { model } = resolveProvider(p);
      const initial = (history || []).map((m) => ({ role: m.role, content: m.content }));
      const chat = new LlmChat(key, sessionId || `s-${Date.now()}`, systemMessage || 'You are a helpful assistant.', initial)
        .withModel(p, model)
        .withParams({ temperature, max_tokens: maxTokens });
      const res = await chat.sendMessage(new UserMessage({ text: prompt }));
      const text = typeof res === 'string' ? res : (res?.text || res?.content || JSON.stringify(res));
      return { text, provider: p, model };
    } catch (e) {
      lastErr = e;
      console.error(`[llm] provider ${p} failed:`, e.message);
    }
  }
  throw lastErr || new Error('All AI providers failed');
}

export function parseJson(text) {
  if (!text) throw new Error('empty');
  let cleaned = String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const first = cleaned.indexOf('{');
  const arrFirst = cleaned.indexOf('[');
  const start = arrFirst !== -1 && (arrFirst < first || first === -1) ? arrFirst : first;
  if (start > 0) cleaned = cleaned.slice(start);
  const lastObj = cleaned.lastIndexOf('}');
  const lastArr = cleaned.lastIndexOf(']');
  const end = Math.max(lastObj, lastArr);
  if (end !== -1) cleaned = cleaned.slice(0, end + 1);
  return JSON.parse(cleaned);
}

// Ask for JSON with one repair retry.
export async function askJson(opts) {
  const { text, provider, model } = await ask({ ...opts, temperature: opts.temperature ?? 0.2 });
  try {
    return { data: parseJson(text), provider, model };
  } catch (e) {
    const repair = await ask({ ...opts, temperature: 0, prompt: `Fix this into STRICT valid JSON only, no markdown, no commentary:\n${text}` });
    return { data: parseJson(repair.text), provider: repair.provider, model: repair.model };
  }
}
