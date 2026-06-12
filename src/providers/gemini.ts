import { loadConfig } from "../config.js";

export async function generateWithGemini(
    prompt: string,
    model?: string,
): Promise<string> {
    const config = loadConfig();
    const apiKey = config.geminiApiKey;
    if (!apiKey) {
        throw new Error("Gemini API key is missing. Set GEMINI_API_KEY environment variable.");
    }
    const selectedModel = model || config.geminiModel || 'gemini-flash-latest';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent`;

    const body = {
        contents: [
            {
                parts: [{ text: prompt }],
            },
        ],
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errBody}`);
    }

    const json = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
    };

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        throw new Error('Empty response from Gemini');
    }
    return text;
}
