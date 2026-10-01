// USD per million tokens, Anthropic first-party API rates (checked 1 Oct 2026).
// Cache writes are the 5-minute TTL rate. Thinking tokens are billed as output.
type Rates = { input: number; output: number; cacheRead: number; cacheWrite: number };

const RATES: Record<string, Rates> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-opus-5": { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export type Usage = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
};

export function costUsd(model: string, usage: Usage): number {
  const key = Object.keys(RATES).find((k) => model.startsWith(k));
  if (!key) throw new Error(`No pricing for model ${model}; add it to lib/ai/pricing.ts`);
  const r = RATES[key];
  return (
    (usage.input_tokens * r.input +
      usage.output_tokens * r.output +
      usage.cache_read_input_tokens * r.cacheRead +
      usage.cache_creation_input_tokens * r.cacheWrite) /
    1_000_000
  );
}
