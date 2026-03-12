import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { authRoutes } from './routes/auth';
import { dyteRoutes } from './routes/dyte';
import { emailRoutes } from './routes/email';
import { llmRoutes } from './routes/llm';

const PORT = Number(process.env.SERVER_PORT ?? 3001);
const ALLOWED_ORIGIN = process.env.VITE_ORIGIN ?? 'http://localhost:5173';

const app = new Elysia()
    .use(cors({
        origin: ALLOWED_ORIGIN,
        methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true, // needed for session cookies
    }))
    .get('/health', () => ({ ok: true, ts: Date.now() }))
    .use(authRoutes)
    .use(dyteRoutes)
    .use(emailRoutes)
    .use(llmRoutes)
    .listen(PORT, () => {
        console.log(`🦊 Timey API  →  http://localhost:${PORT}`);
        console.log(`   Auth       →  /api/auth/*`);
        console.log(`   Dyte       →  /api/dyte/*`);
        console.log(`   Email      →  /api/email/*`);
        console.log(`   LLM        →  /api/llm/*`);
    });

export type App = typeof app;
