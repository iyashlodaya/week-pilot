import OpenAI from "openai";

const ollamaClient = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama', //required by client, ignored by Ollama.   
})

export async function generateWithOllama(
    prompt: string,
    systemPrompt?: string,
    model: string = process.env['OLLAMA_MODEL'] || 'gemma4',
): Promise<string> {
    const messages: any[] = [];
    if (systemPrompt) {
        messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await ollamaClient.chat.completions.create({
        model,
        messages
    });

    return response.choices[0]?.message?.content || ''
}