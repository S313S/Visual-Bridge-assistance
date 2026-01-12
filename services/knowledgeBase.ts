/// <reference types="vite/client" />

// Helper to get environment variables
const getEnvVar = (key: string) => {
    // Vite exposes env vars on import.meta.env
    return import.meta.env[key] || process.env[key] || "";
};

export const fetchExternalKnowledge = async (): Promise<string> => {
    const url = getEnvVar('VITE_KB_URL');
    const token = getEnvVar('VITE_GITHUB_TOKEN');

    if (!url) {
        console.log("No Knowledge Base URL configured.");
        return "";
    }

    try {
        const headers: HeadersInit = {
            'Accept': 'application/vnd.github.v3.raw' // Request raw content
        };

        if (token) {
            headers['Authorization'] = `token ${token}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
            console.error(`Failed to fetch Knowledge Base: ${response.status} ${response.statusText}`);
            return "";
        }

        const text = await response.text();
        console.log("Successfully fetched Knowledge Base content.");
        return text;

    } catch (error) {
        console.error("Error fetching Knowledge Base:", error);
        return "";
    }
};
