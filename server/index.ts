import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.VITE_ORIGIN ?? 'http://localhost:5173';

const PROVIDER_DEFAULT_URLS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com',
    openrouter: 'https://openrouter.ai',
};

async function listModels(
    providerType: string,
    apiKey: string | undefined,
    baseUrl: string | undefined,
): Promise<{ id: string; label: string }[]> {
    const base = baseUrl?.trim() || PROVIDER_DEFAULT_URLS[providerType] || '';
    if (!base) throw new Error(`Unknown provider type: ${providerType}`);

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (providerType === 'anthropic') {
        if (!apiKey) throw new Error('API key required for Anthropic');
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        const res = await fetch(`${base}/v1/models`, { headers });
        if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data: { id: string; display_name?: string }[] };
        return (data.data ?? []).map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
    }

    if (providerType === 'openai') {
        if (!apiKey) throw new Error('API key required for OpenAI');
        headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(`${base}/v1/models`, { headers });
        if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data: { id: string }[] };
        return (data.data ?? [])
            .filter((m) => /^(gpt-|o1|o3|o4)/.test(m.id))
            .sort((a, b) => b.id.localeCompare(a.id))
            .map((m) => ({ id: m.id, label: m.id }));
    }

    if (providerType === 'openrouter') {
        if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
        const res = await fetch(`${base}/api/v1/models`, { headers });
        if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
        const data = await res.json() as { data: { id: string; name?: string }[] };
        return (data.data ?? []).map((m) => ({ id: m.id, label: m.name ?? m.id }));
    }

    // custom / openai-compatible
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    const res = await fetch(`${base}/v1/models`, { headers });
    if (!res.ok) throw new Error(`Provider ${res.status}: ${await res.text()}`);
    const data = await res.json() as { data: { id: string; name?: string }[] };
    return (data.data ?? []).map((m) => ({ id: m.id, label: m.name ?? m.id }));
}

const app = new Elysia()
    .use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST', 'OPTIONS'] }))

    .get('/health', () => ({ ok: true, ts: Date.now() }))

    .post(
        '/api/llm/models',
        async ({ body, error }) => {
            try {
                const models = await listModels(body.providerType, body.apiKey, body.baseUrl);
                return { models };
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return error(502, { error: msg });
            }
        },
        {
            body: t.Object({
                providerType: t.String(),
                apiKey: t.Optional(t.String()),
                baseUrl: t.Optional(t.String()),
            }),
        },
    )

    .listen(PORT, () => {
        console.log(`🦊 Timey API server running on http://localhost:${PORT}`);
    });

export type App = typeof app;
