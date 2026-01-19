import { SYSTEM_INSTRUCTION } from "../constants";

// Production Worker URL (safe to expose - this is public endpoint)
const PRODUCTION_WORKER_URL = "https://visual-bridge-proxy.visual-bridge.workers.dev";

// Get Worker URL (if deployed to Cloudflare) or null for direct API mode
const getWorkerUrl = (): string | null => {
    // Check for build-time env var first
    const envWorkerUrl = import.meta.env.VITE_WORKER_URL;
    if (envWorkerUrl) return envWorkerUrl;

    // Check localStorage for runtime override
    const config = getConfig();
    if (config.workerUrl) return config.workerUrl;

    // Always use production Worker URL as fallback
    return PRODUCTION_WORKER_URL;
};

// Helper to get config from localStorage or Env
const getConfig = () => {
    const local = localStorage.getItem('visual_bridge_config');
    if (local) {
        return JSON.parse(local);
    }
    return {};
};

// Helper to get API key safely (only needed for direct mode)
const getApiKey = () => {
    const config = getConfig();
    if (config.volcApiKey) return config.volcApiKey;

    const key = import.meta.env.VITE_VOLC_API_KEY || "";
    return key;
};

// Configuration for Volcengine (direct mode only)
const getVolcConfig = () => {
    const config = getConfig();
    return {
        BASE_URL: "https://ark.cn-beijing.volces.com/api/v3",
        TEXT_MODEL: config.volcTextModel || import.meta.env.VITE_VOLC_TEXT_MODEL || "doubao-seed-1-8-251228",
        IMAGE_MODEL: config.volcImageModel || import.meta.env.VITE_VOLC_IMAGE_MODEL || "doubao-seedream-4-5-251128"
    };
};

// Check if we're in Worker mode
export const isWorkerMode = (): boolean => !!getWorkerUrl();

export interface ThoughtProcessStep {
    step: string;
    content: string;
    knowledgeUsed: string | null;
}

export interface ChatResponse {
    text: string;
    visualPrompts?: string[];
    aspectRatio?: string;
    reasoning?: string;
    thoughtProcess?: ThoughtProcessStep[];
}

export const sendMessageToDoubao = async (
    history: { role: string; parts: { text: string }[] }[],
    lastMessage: string,
    systemInstructionOverride?: string
): Promise<ChatResponse> => {
    // Use override if provided, otherwise default
    const sysInstruction = systemInstructionOverride || SYSTEM_INSTRUCTION;

    // Convert Gemini-style history to OpenAI/Doubao format
    const messages = [
        { role: "system", content: sysInstruction },
        ...history.map(msg => ({
            role: msg.role === 'model' ? 'assistant' : msg.role,
            content: msg.parts[0].text
        })),
        { role: "user", content: lastMessage }
    ];

    const workerUrl = getWorkerUrl();

    try {
        let response: Response;

        if (workerUrl) {
            // Worker mode: call our Cloudflare Worker proxy
            console.log("[API] Using Worker mode:", workerUrl);
            response = await fetch(`${workerUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: messages,
                    temperature: 0.7,
                    stream: false
                })
            });
        } else {
            // Direct mode: call Volcengine API directly (requires API key)
            const apiKey = getApiKey();
            const config = getVolcConfig();
            console.log("[API] Using Direct mode");
            response = await fetch(`${config.BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: config.TEXT_MODEL,
                    messages: messages,
                    temperature: 0.7,
                    stream: false
                })
            });
        }

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
                    reasoning: jsonContent.reasoning,
                    thoughtProcess: jsonContent.thoughtProcess
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
    // Check if prompt contains aspect ratio (e.g. "16:9", "21:9") overrides the passed argument
    const ratioMatch = prompt.match(/\b(\d+:\d+)\b/);
    if (ratioMatch) {
        const foundRatio = ratioMatch[1];
        if (["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"].includes(foundRatio)) {
            aspectRatio = foundRatio;
        }
    }

    let width = 2048;
    let height = 2048;

    // Doubao Seedream size mapping based on user provided table
    switch (aspectRatio) {
        case "1:1": width = 2048; height = 2048; break;
        case "4:3": width = 2304; height = 1728; break;
        case "3:4": width = 1728; height = 2304; break;
        case "16:9": width = 2560; height = 1440; break;
        case "9:16": width = 1440; height = 2560; break;
        case "3:2": width = 2496; height = 1664; break;
        case "2:3": width = 1664; height = 2496; break;
        case "21:9": width = 3024; height = 1296; break;
        default: width = 2048; height = 2048;
    }

    const workerUrl = getWorkerUrl();

    try {
        let response: Response;

        if (workerUrl) {
            // Worker mode
            console.log("[API] Image generation via Worker");
            response = await fetch(`${workerUrl}/api/image`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: prompt,
                    size: `${width}x${height}`
                })
            });
        } else {
            // Direct mode
            const apiKey = getApiKey();
            const config = getVolcConfig();
            console.log("[API] Image generation via Direct API");
            response = await fetch(`${config.BASE_URL}/images/generations`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: config.IMAGE_MODEL,
                    prompt: prompt,
                    size: `${width}x${height}`,
                    return_url: true,
                    watermark: false
                })
            });
        }

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
