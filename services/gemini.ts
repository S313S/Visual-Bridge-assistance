import { GoogleGenAI, Type } from "@google/genai";
import { SYSTEM_INSTRUCTION } from "../constants";

// Helper to get API key safely
const getApiKey = () => {
  const key = process.env.API_KEY;
  if (!key) {
    console.error("API_KEY is missing from environment variables");
    return "";
  }
  return key;
};

// Initialize Gemini Client
const getClient = () => new GoogleGenAI({ apiKey: getApiKey() });

export interface ChatResponse {
  text: string;
  visualPrompts?: string[];
  aspectRatio?: string;
  reasoning?: string;
}

export const sendMessageToGemini = async (
  history: { role: string; parts: { text: string }[] }[],
  lastMessage: string
): Promise<ChatResponse> => {
  const ai = getClient();
  
  try {
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.7,
      },
      history: history,
    });

    const result = await chat.sendMessage({ message: lastMessage });
    const responseText = result.text;

    // Parse for JSON trigger
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);
    
    if (jsonMatch) {
      try {
        const jsonContent = JSON.parse(jsonMatch[1]);
        // Remove the JSON block from the visible text to keep chat clean
        const cleanText = responseText.replace(/```json\s*[\s\S]*?\s*```/, '').trim();
        
        // Handle backward compatibility if model returns singular visualPrompt
        let prompts: string[] = [];
        if (jsonContent.visualPrompts && Array.isArray(jsonContent.visualPrompts)) {
            prompts = jsonContent.visualPrompts;
        } else if (jsonContent.visualPrompt) {
            prompts = Array(4).fill(jsonContent.visualPrompt);
        }

        // Ensure we have exactly 4 prompts if possible, filling if necessary
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
          text: cleanText || "已分析您的需求，正在生成示例...",
          visualPrompts: prompts.length > 0 ? prompts : undefined,
          aspectRatio: aspectRatio,
          reasoning: jsonContent.reasoning
        };
      } catch (e) {
        console.error("Failed to parse JSON trigger", e);
        return { text: responseText };
      }
    }

    return { text: responseText };

  } catch (error) {
    console.error("Error calling Gemini Chat:", error);
    return { text: "抱歉，与 AI 服务通信时出现错误。" };
  }
};

export const generateImageWithGemini = async (prompt: string, aspectRatio: string = "1:1"): Promise<string> => {
  const ai = getClient();
  
  try {
    // Using gemini-2.5-flash-image for standard generation as per guidelines
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }]
      },
      config: {
        imageConfig: {
            aspectRatio: aspectRatio
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data found in response");

  } catch (error) {
    console.error("Error generating image:", error);
    return ""; 
  }
};