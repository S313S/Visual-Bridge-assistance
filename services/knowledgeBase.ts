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



// Helper: Parse GitHub URL to API Endpoint
const getApiUrl = (url: string) => {
    try {
        const u = new URL(url);
        // Match: github.com/:owner/:repo/blob/:ref/:path...
        const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
        if (match) {
            const [, owner, repo, ref, path] = match;
            // Decode path to handle Chinese characters and other encoded symbols
            const decodedPath = decodeURIComponent(path);
            return `https://api.github.com/repos/${owner}/${repo}/contents/${decodedPath}?ref=${ref}`;
        }
        // Match raw: raw.githubusercontent.com/:owner/:repo/:ref/:path...
        const matchRaw = u.pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
        if (u.hostname === 'raw.githubusercontent.com' && matchRaw) {
            const [, owner, repo, ref, path] = matchRaw;
            const decodedPath = decodeURIComponent(path);
            return `https://api.github.com/repos/${owner}/${repo}/contents/${decodedPath}?ref=${ref}`;
        }
    } catch (e) { console.error("Invalid URL", e); }
    return null;
};

const fetchUrlContent = async (originalUrl: string, token?: string): Promise<string> => {
    if (!originalUrl) return "";

    // Try to convert to API URL for batter CORS support
    const apiUrl = getApiUrl(originalUrl);
    const fetchUrl = apiUrl || originalUrl;

    try {
        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3+json'
        };

        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        console.log(`[DEBUG] Fetching: ${fetchUrl} (API Mode: ${!!apiUrl})`);

        const response = await fetch(fetchUrl, { headers });

        if (!response.ok) {
            console.error(`[DEBUG] Failed to fetch KB from ${fetchUrl}: ${response.status} ${response.statusText}`);
            return "";
        }

        const data = await response.json();

        // If using API, decode content
        if (apiUrl && data.content && data.encoding === 'base64') {
            // Decode base64 (handle utf-8 correctly)
            const binaryString = window.atob(data.content.replace(/\n/g, ''));
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(bytes);

            console.log(`[DEBUG] Successfully fetched & decoded KB via API (${text.length} chars)`);
            return text;
        }

        // Fallback or unexpected format (should not happen if logic matches)
        console.warn("[DEBUG] Response format trace:", data);
        return "";

    } catch (error) {
        console.error(`[DEBUG] Error fetching KB from ${fetchUrl}:`, error);
        return "";
    }
};

export interface KnowledgeBaseResult {
    combined: string;
    rolePrompt: { loaded: boolean; chars: number; name: string };
    doubaoKb: { loaded: boolean; chars: number; name: string };
}

export const fetchExternalKnowledge = async (): Promise<KnowledgeBaseResult> => {
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

    // Extract filename from URL for display
    const getFilename = (url: string) => {
        if (!url) return "未配置";
        const parts = url.split('/');
        return parts[parts.length - 1] || url;
    };

    return {
        combined: combined.trim(),
        rolePrompt: {
            loaded: !!roleContent,
            chars: roleContent.length,
            name: getFilename(kbUrl || "")
        },
        doubaoKb: {
            loaded: !!doubaoContent,
            chars: doubaoContent.length,
            name: getFilename(doubaoKbUrl || "")
        }
    };
};
