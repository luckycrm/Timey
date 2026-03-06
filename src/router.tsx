import { createRouter as createTanStackRouter } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query';
import { Identity } from 'spacetimedb';
import { routeTree } from './routeTree.gen';
import {
  SpacetimeDBQueryClient,
  SpacetimeDBProvider,
} from 'spacetimedb/tanstack';
import { DbConnection, ErrorContext } from './module_bindings';

const HOST =
  import.meta.env.VITE_SPACETIMEDB_HOST ??
  'https://maincloud.spacetimedb.com';
const DB_NAME = import.meta.env.VITE_SPACETIMEDB_DB_NAME ?? 'timeydb';
const TOKEN_KEY = `${HOST}/${DB_NAME}/auth_token`;
const CHAT_DRAFT_PREFIX = 'timey-chat-draft-';

// Safe localStorage helpers for SSR (Node.js 22+ has a localStorage stub that throws)
function getStoredToken(): string | undefined {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // SSR - ignore
  }
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // SSR - ignore
  }
}

export function hasStoredToken(): boolean {
  return getStoredToken() !== undefined;
}

const spacetimeDBQueryClient = new SpacetimeDBQueryClient();

const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: spacetimeDBQueryClient.queryFn,
      staleTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
    },
  },
});
spacetimeDBQueryClient.connect(queryClient);

const onConnect = (conn: DbConnection, identity: Identity, token: string) => {
  storeToken(token);
  console.log(
    'Connected to SpacetimeDB with identity:',
    identity.toHexString()
  );
  spacetimeDBQueryClient.setConnection(conn);
};

const onDisconnect = () => {
  console.log('Disconnected from SpacetimeDB');
};

const onConnectError = (_ctx: ErrorContext, err: Error) => {
  console.error('Error connecting to SpacetimeDB:', err);
};

const connectionBuilder = DbConnection.builder()
  .withUri(HOST)
  .withDatabaseName(DB_NAME)
  .withToken(getStoredToken())
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .onConnectError(onConnectError);

interface ResetClientStateOptions {
  clearSpacetimeToken?: boolean;
}

export function resetClientState(
  options: ResetClientStateOptions = {}
): void {
  const { clearSpacetimeToken = true } = options;

  if (clearSpacetimeToken) {
    clearStoredToken();
  }

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CHAT_DRAFT_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch {
    // SSR - ignore
  }

  // Reset all cached realtime query data/subscriptions between identities.
  spacetimeDBQueryClient.disconnect();
  queryClient.clear();
  spacetimeDBQueryClient.connect(queryClient);
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultNotFoundComponent: () => (
      <div style={{ padding: '2rem' }}>
        <h1>404</h1>
        <p>Page Not Found</p>
      </div>
    ),
    context: { queryClient },
    Wrap: ({ children }) => (
      <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
        {children}
      </SpacetimeDBProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
