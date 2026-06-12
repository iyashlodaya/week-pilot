import OpenAI from "openai";

const ollamaClient = new OpenAI({
    baseURL: 'http://localhost:11434/v1',
    apiKey: 'ollama', //required by client, ignored by Ollama.   
})

export async function generateWithOllama(
    prompt: string,
    model: string = 'gemma4',
): Promise<string> {
    const response = await ollamaClient.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }]
    });

    return response.choices[0]?.message?.content || ''
}