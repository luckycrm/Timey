import { Elysia, t } from 'elysia';

const PROVIDER_DEFAULTS: Record<string, string> = {
    anthropic: 'https://api.anthropic.com',
    openai: 'https://api.openai.com',
    openrouter: 'https://openrouter.ai',
};

async function listModels(providerType: string, apiKey: string | undefined, baseUrl: string | undefined): Promise<{ id: string; label: string }[]> {
    const base = baseUrl?.trim() || PROVIDER_DEFAULTS[providerType] || '';
    if (!base) throw new Error(`Unknown provider: ${providerType}`);

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

export const llmRoutes = new Elysia({ prefix: '/api/llm' })
    .post('/models', async ({ body, error }) => {
        try {
            const models = await listModels(body.providerType, body.apiKey, body.baseUrl);
            return { models };
        } catch (e) {
            return error(502, { error: e instanceof Error ? e.message : String(e) });
        }
    }, {
        body: t.Object({
            providerType: t.String(),
            apiKey: t.Optional(t.String()),
            baseUrl: t.Optional(t.String()),
        }),
    });
