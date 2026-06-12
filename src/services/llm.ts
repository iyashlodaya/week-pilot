import { generateWithOllama } from "../providers/ollama.js";

type Provider = 'ollama' | 'gemini' | 'openai';

interface ProviderResult {
    success: boolean;
    provider: Provider;
    result?: string;
    error?: string;
    durationMs: number;
}

const OLLAMA_TIMEOUT_MS = 10000; // 10 Seconds

async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label: string
): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    );
    return Promise.race([promise, timeout]);
}


export async function generateSummary(prompt: string): Promise<string> {
    const providers: Provider[] = ['ollama', 'gemini', 'openai'];
    const attempts: ProviderResult[] = [];

    for (const provider of providers) {
        const start = Date.now();
        try {
            let result: string;

            if (provider === 'ollama') {
                result = await withTimeout(
                    generateWithOllama(prompt),
                    OLLAMA_TIMEOUT_MS,
                    'Ollama'
                );
            } else if (provider === 'gemini') {
                result = await generateWithGemini(prompt);
            } else {
                result = await generateWithOpenAI(prompt);
            }

            const durationMs = Date.now() - start;
            attempts.push({ success: true, provider, durationMs });

            // Log which provider handled it
            console.log(`✓ ${provider} responded in ${durationMs}ms`);
            return result;

        } catch (error) {
            const durationMs = Date.now() - start;
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            attempts.push({ success: false, provider, error: errorMsg, durationMs });

            // Log the failure and try next
            console.log(`✗ ${provider} failed (${durationMs}ms): ${errorMsg}`);
        }
    };

    // All providers failed
    const summary = attempts
        .map(a => `${a.provider}: ${a.error}`)
        .join(', ');
    throw new Error(`All LLM providers failed. Attempts: ${summary}`);
}
