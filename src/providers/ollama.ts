import OpenAI from "openai";
import { loadConfig } from "../config.js";

const ollamaClient = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama', //required by client, ignored by Ollama.   
})

export async function generateWithOllama(
    prompt: string,
    systemPrompt?: string,
    model?: string,
): Promise<string> {
    const config = loadConfig();
    const messages: any[] = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const selectedModel = model || config.ollamaModel || 'gemma4';

    const response = await ollamaClient.chat.completions.create({
        model: selectedModel,
        messages
    });

    return response.choices[0]?.message?.content || ''
}