import { SYSTEM_INSTRUCTION } from "../constants";

// Helper to get API key safely
const getApiKey = () => {
    const key = process.env.VOLC_API_KEY || process.env.API_KEY;
    if (!key) {
        console.error("VOLC_API_KEY is missing from environment variables");
        return "";
    }
    return key;
};

// Configuration for Volcengine
// In a real scenario, these Endpoint IDs should be configurable via env vars
// because each user deployment gets a unique endpoint ID.
const CONFIG = {
    BASE_URL: "https://ark.cn-beijing.volces.com/api/v3",
    // These are default model names/IDs. Users might need to replace these 
    // with their specific Endpoint IDs (e.g. ep-2024...) if using custom deployments.
    TEXT_MODEL: process.env.VOLC_TEXT_MODEL || "doubao-seed-1-8",
    IMAGE_MODEL: process.env.VOLC_IMAGE_MODEL || "doubao-seedream-4-5"
};

export interface ChatResponse {
    text: string;
    visualPrompts?: string[];
    aspectRatio?: string;
    reasoning?: string;
}

export const sendMessageToDoubao = async (
    history: { role: string; parts: { text: string }[] }[],
    lastMessage: string
): Promise<ChatResponse> => {
    const apiKey = getApiKey();

    // Convert Gemini-style history to OpenAI/Doubao format
    const messages = [
        { role: "system", content: SYSTEM_INSTRUCTION },
        ...history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: msg.parts[0].text
        })),
        { role: "user", content: lastMessage }
    ];

    try {
        const response = await fetch(`${CONFIG.BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.TEXT_MODEL,
                messages: messages,
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Volcengine Text API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        const responseText = data.choices?.[0]?.message?.content || "";

        // Parse for JSON trigger (Same logic as Gemini service)
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

        if (jsonMatch) {
            try {
                const jsonContent = JSON.parse(jsonMatch[1]);
                const cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();

                // Normalize visual prompts
                let prompts: string[] = [];
                if (jsonContent.visualPrompts && Array.isArray(jsonContent.visualPrompts)) {
                    prompts = jsonContent.visualPrompts;
                } else if (jsonContent.visualPrompt) {
                    prompts = Array(4).fill(jsonContent.visualPrompt);
                }

                // Fill to 4 items
                if (prompts.length > 0 && prompts.length < 4) {
                    const originalLength = prompts.length;
                    for (let i = originalLength; i < 4; i++) {
                        prompts.push(prompts[0]);
                    }
                }

                // Validate Aspect Ratio
                const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
                let aspectRatio = "1:1";
                if (jsonContent.aspectRatio && validRatios.includes(jsonContent.aspectRatio)) {
                    aspectRatio = jsonContent.aspectRatio;
                }

                return {
                    text: cleanText || "已分析您的需求，正在生成参考方案...",
                    visualPrompts: prompts.length > 0 ? prompts : undefined,
                    aspectRatio: aspectRatio,
                    reasoning: jsonContent.reasoning
                };
            } catch (e) {
                console.error("Failed to parse JSON from Doubao", e);
                return { text: responseText };
            }
        }

        return { text: responseText };

    } catch (error) {
        console.error("Error calling Doubao Chat:", error);
        return { text: "抱歉，与 AI 服务通信时出现错误 (Volcengine)。请检查 API Key 配置。" };
    }
};

export const generateImageWithDoubao = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
    const apiKey = getApiKey();

    // Map aspect ratio to closest supported size if needed, 
    // or Doubao might ignore it if not strictly "width" x "height".
    // Doubao Seedream usually takes width/height args or size preset.
    // We'll map common ratios to approximate pixel dimensions for "custom" or use closest preset.
    // The API docs conventionally use `size` (e.g. 1024x1024).

    let width = 1024;
    let height = 1024;

    switch (aspectRatio) {
        case "3:4": width = 768; height = 1024; break;
        case "4:3": width = 1024; height = 768; break;
        case "9:16": width = 576; height = 1024; break;
        case "16:9": width = 1024; height = 576; break;
        default: width = 1024; height = 1024; // 1:1
    }

    try {
        const response = await fetch(`${CONFIG.BASE_URL}/images/generations`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: CONFIG.IMAGE_MODEL,
                prompt: prompt,
                width: width,
                height: height,
                return_url: true // We want a URL usually, but let's check what App expects. App expects string URL/Base64.
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Volcengine Image API Error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        // API output structure typically: { data: [ { url: "..." } ] }
        const imageUrl = data.data?.[0]?.url;

        if (!imageUrl) {
            throw new Error("No image URL found in Doubao response");
        }

        return imageUrl;

    } catch (error) {
        console.error("Error generating image with Doubao:", error);
        return "";
    }
};
