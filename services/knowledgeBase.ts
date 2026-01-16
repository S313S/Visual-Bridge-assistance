/// <reference types="vite/client" />

// Interface for Config (matching SettingsModal)
interface AppConfig {
    volcApiKey: string;
    volcTextModel: string;
    volcImageModel: string;
    kbUrl: string;
    doubaoKbUrl: string;
    githubToken: string;
}

// Helper to get config from localStorage or Env
const getConfig = (): Partial<AppConfig> => {
    const local = localStorage.getItem('visual_bridge_config');
    if (local) {
        return JSON.parse(local);
    }
    // Fallback to env vars
    return {
        kbUrl: import.meta.env.VITE_KB_URL || process.env.VITE_KB_URL,
        githubToken: import.meta.env.VITE_GITHUB_TOKEN || process.env.VITE_GITHUB_TOKEN
    };
};



// Helper: Normalize GitHub URLs (blob -> raw) to avoid HTML/CORS issues
const normalizeUrl = (url: string) => {
    if (!url) return "";
    // If it's a standard GitHub blob URL, convert to raw
    if (url.includes('github.com') && url.includes('/blob/')) {
        return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    }
    return url;
};

const fetchUrlContent = async (originalUrl: string, token?: string): Promise<string> => {
    const url = normalizeUrl(originalUrl);
    if (!url) return "";

    try {
        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3.raw' // Request raw content
        };

        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error(`Failed to fetch KB from ${url}: ${response.status} ${response.statusText}`);
            return "";
        }

        return await response.text();
    } catch (error) {
        console.error(`Error fetching KB from ${url}:`, error);
        return "";
    }
};

export const fetchExternalKnowledge = async (): Promise<string> => {
    const config = getConfig();
    const { kbUrl, doubaoKbUrl, githubToken } = config;

    console.log("Fetching Knowledge Bases...");

    // Fetch both in parallel
    const [roleContent, doubaoContent] = await Promise.all([
        fetchUrlContent(kbUrl || "", githubToken),
        fetchUrlContent(doubaoKbUrl || "", githubToken)
    ]);

    let combined = "";

    if (roleContent) {
        combined += `### Role System Prompt / Persona Context:\n${roleContent}\n\n`;
    }

    if (doubaoContent) {
        combined += `### Doubao Model Specific Guidelines & Knowledge:\n${doubaoContent}\n\n`;
    }

    if (combined) {
        console.log("Knowledge Base loaded successfully.");
    } else {
        console.log("No Knowledge Base content found.");
    }

    return combined.trim();
};
