import OpenAI from "openai";
import { loadConfig } from "../config.js";

export async function generateWithOpenAI(
    prompt: string,
    model?: string,
): Promise<string> {
    const config = loadConfig();
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
        throw new Error("OpenAI API key is missing. Set OPENAI_API_KEY environment variable or run `weekpilot config`.");
    }
    const client = new OpenAI({ apiKey });
    const selectedModel = model || config.openaiModel || 'gpt-4o-mini';

    const response = await client.chat.completions.create({
        model: selectedModel,
        messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0]?.message?.content || '';
}
