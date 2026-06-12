import { generateWithOllama } from "../providers/ollama.js";
import { generateWithGemini } from "../providers/gemini.js";
import { generateWithOpenAI } from "../providers/openai.js";
import { loadConfig } from "../config.js";

type Provider = 'ollama' | 'gemini' | 'openai';

interface ProviderResult {
    success: boolean;
    provider: Provider;
    result?: string;
    error?: string;
    durationMs: number;
}

const OLLAMA_TIMEOUT_MS = process.env.OLLAMA_MODEL_TIMEOUT
    ? parseInt(process.env.OLLAMA_MODEL_TIMEOUT, 10)
    : 30000; // 30 Seconds

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


export async function generateSummary(
    prompt: string,
    systemPrompt?: string,
): Promise<string> {
    const config = loadConfig();
    const preferred = config.llmProvider;
    const providers: Provider[] = preferred === 'gemini'
        ? ['ollama', 'gemini', 'openai']
        : ['ollama', 'openai', 'gemini'];

    const attempts: ProviderResult[] = [];

    for (const provider of providers) {
        const start = Date.now();
        try {
            let result: string;

            if (provider === 'ollama') {
                result = await withTimeout(
                    generateWithOllama(prompt, systemPrompt),
                    OLLAMA_TIMEOUT_MS,
                    'Ollama'
                );
            } else if (provider === 'gemini') {
                result = await generateWithGemini(prompt, systemPrompt);
            } else {
                result = await generateWithOpenAI(prompt, systemPrompt);
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
