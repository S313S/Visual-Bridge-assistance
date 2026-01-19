/**
 * Visual Bridge AI - Cloudflare Worker Proxy
 * 
 * This Worker acts as a secure proxy for:
 * 1. Volcengine Doubao (Text & Image APIs)
 * 2. GitHub API (Knowledge Base)
 * 
 * Environment Variables (set in Cloudflare Dashboard > Worker > Settings > Variables):
 * - VOLC_API_KEY: Volcengine API Key
 * - VOLC_TEXT_MODEL: Text model endpoint ID (e.g., "doubao-seed-1-8-251228")
 * - VOLC_IMAGE_MODEL: Image model endpoint ID (e.g., "doubao-seedream-4-5-251128")
 * - GITHUB_TOKEN: GitHub Personal Access Token
 * - KB_URL: Role prompt GitHub URL
 * - DOUBAO_KB_URL: Doubao knowledge base GitHub URL
 * - ALLOWED_ORIGIN: Frontend origin for CORS (e.g., "https://s313s.github.io")
 */

const VOLC_TEXT_API = "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const VOLC_IMAGE_API = "https://ark.cn-beijing.volces.com/api/v3/images/generations";

// CORS headers
const corsHeaders = (origin) => ({
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
});

// Handle CORS preflight
function handleOptions(request, env) {
    const origin = request.headers.get("Origin");
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    // Check if origin is allowed (allow localhost for dev testing)
    let isAllowed = allowedOrigin === "*" || origin === allowedOrigin;
    if (!isAllowed && origin && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
        isAllowed = true;
    }

    if (!isAllowed) {
        return new Response("Forbidden", { status: 403 });
    }

    return new Response(null, {
        headers: corsHeaders(origin),
    });
}

// Wrap response with CORS headers
function withCors(response, env, requestOrigin) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    // Determine the origin to allow
    let originToAllow = allowedOrigin;
    if (allowedOrigin !== "*" && requestOrigin && (requestOrigin.startsWith("http://localhost:") || requestOrigin.startsWith("http://127.0.0.1:"))) {
        originToAllow = requestOrigin;
    } else if (allowedOrigin === "*") {
        originToAllow = requestOrigin;
    }

    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders(originToAllow)).forEach(([key, value]) => {
        newHeaders.set(key, value);
    });

    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
}

// Parse GitHub URL to API endpoint
function getGitHubApiUrl(url) {
    try {
        const u = new URL(url);
        const match = u.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
        if (match) {
            const [, owner, repo, ref, path] = match;
            const decodedPath = decodeURIComponent(path);
            return `https://api.github.com/repos/${owner}/${repo}/contents/${decodedPath}?ref=${ref}`;
        }
    } catch (e) {
        console.error("Invalid GitHub URL", e);
    }
    return null;
}

// Fetch GitHub content
async function fetchGitHubContent(url, token) {
    const apiUrl = getGitHubApiUrl(url);
    if (!apiUrl) return "";

    try {
        const response = await fetch(apiUrl, {
            headers: {
                "Accept": "application/vnd.github.v3+json",
                "Authorization": `token ${token}`,
                "User-Agent": "Visual-Bridge-Worker",
            },
        });

        if (!response.ok) {
            console.error(`GitHub API error: ${response.status}`);
            return "";
        }

        const data = await response.json();

        if (data.content && data.encoding === "base64") {
            // Decode base64 content
            const decoded = atob(data.content.replace(/\n/g, ""));
            // Handle UTF-8
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }
            return new TextDecoder("utf-8").decode(bytes);
        }
    } catch (e) {
        console.error("GitHub fetch error:", e);
    }
    return "";
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const origin = request.headers.get("Origin");

        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return handleOptions(request, env);
        }

        // Route: Health check
        if (url.pathname === "/" || url.pathname === "/health") {
            return withCors(
                new Response(JSON.stringify({ status: "ok", service: "visual-bridge-proxy" }), {
                    headers: { "Content-Type": "application/json" },
                }),
                env,
                origin
            );
        }

        // Route: Get config (returns model IDs, no secrets)
        if (url.pathname === "/api/config" && request.method === "GET") {
            return withCors(
                new Response(JSON.stringify({
                    volcTextModel: env.VOLC_TEXT_MODEL || "doubao-seed-1-8-251228",
                    volcImageModel: env.VOLC_IMAGE_MODEL || "doubao-seedream-4-5-251128",
                    kbConfigured: !!(env.KB_URL || env.DOUBAO_KB_URL),
                }), {
                    headers: { "Content-Type": "application/json" },
                }),
                env,
                origin
            );
        }

        // Route: Fetch Knowledge Base (accepts URLs from POST body or falls back to env)
        if (url.pathname === "/api/kb" && request.method === "POST") {
            try {
                const body = await request.json();

                // Use URLs from request body, or fall back to env variables
                const kbUrl = body.kbUrl || env.KB_URL || "";
                const doubaoKbUrl = body.doubaoKbUrl || env.DOUBAO_KB_URL || "";

                const [roleContent, doubaoContent] = await Promise.all([
                    kbUrl ? fetchGitHubContent(kbUrl, env.GITHUB_TOKEN) : Promise.resolve(""),
                    doubaoKbUrl ? fetchGitHubContent(doubaoKbUrl, env.GITHUB_TOKEN) : Promise.resolve(""),
                ]);

                let combined = "";
                if (roleContent) {
                    combined += `### Role System Prompt / Persona Context:\n${roleContent}\n\n`;
                }
                if (doubaoContent) {
                    combined += `### Doubao Model Specific Guidelines & Knowledge:\n${doubaoContent}\n\n`;
                }

                return withCors(
                    new Response(JSON.stringify({
                        combined: combined.trim(),
                        rolePrompt: { loaded: !!roleContent, chars: roleContent.length },
                        doubaoKb: { loaded: !!doubaoContent, chars: doubaoContent.length },
                    }), {
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            } catch (e) {
                return withCors(
                    new Response(JSON.stringify({ error: e.message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            }
        }

        // Route: Chat Completion (Volcengine Doubao)
        if (url.pathname === "/api/chat" && request.method === "POST") {
            try {
                const body = await request.json();

                // Use model from env if not provided
                if (!body.model) {
                    body.model = env.VOLC_TEXT_MODEL || "doubao-seed-1-8-251228";
                }

                const response = await fetch(VOLC_TEXT_API, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${env.VOLC_API_KEY}`,
                    },
                    body: JSON.stringify(body),
                });

                const data = await response.json();
                return withCors(
                    new Response(JSON.stringify(data), {
                        status: response.status,
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            } catch (e) {
                return withCors(
                    new Response(JSON.stringify({ error: e.message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            }
        }

        // Route: Image Generation (Volcengine Doubao)
        if (url.pathname === "/api/image" && request.method === "POST") {
            try {
                const body = await request.json();

                // Build image generation request for Volcengine Ark API
                const imageRequest = {
                    model: env.VOLC_IMAGE_MODEL || "doubao-seedream-4-5-251128",
                    prompt: body.prompt,
                    size: body.size || "2048x2048",
                    return_url: true,
                    watermark: false,
                };

                const response = await fetch(VOLC_IMAGE_API, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${env.VOLC_API_KEY}`,
                    },
                    body: JSON.stringify(imageRequest),
                });

                const data = await response.json();
                return withCors(
                    new Response(JSON.stringify(data), {
                        status: response.status,
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            } catch (e) {
                return withCors(
                    new Response(JSON.stringify({ error: e.message }), {
                        status: 500,
                        headers: { "Content-Type": "application/json" },
                    }),
                    env,
                    origin
                );
            }
        }

        // 404 for unknown routes
        return withCors(
            new Response(JSON.stringify({ error: "Not Found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            }),
            env,
            origin
        );
    },
};
