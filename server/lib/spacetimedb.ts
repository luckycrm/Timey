/**
 * SpacetimeDB connection for the Elysia server.
 * Used for server-side reads when needed (e.g. verifying org membership).
 * Most data mutations still go through the frontend client connection.
 */
import { DbConnection, tables } from '../../src/module_bindings/index.js';

const HOST = process.env.VITE_SPACETIMEDB_HOST ?? 'https://maincloud.spacetimedb.com';
const DB_NAME = process.env.VITE_SPACETIMEDB_DB_NAME ?? 'timeydb';
const SERVER_TOKEN = process.env.SPACETIMEDB_SERVER_TOKEN ?? '';

let _conn: DbConnection | null = null;

export function getSpacetimeDB(): DbConnection {
    if (_conn) return _conn;

    _conn = DbConnection.builder()
        .withUri(HOST)
        .withDatabaseName(DB_NAME)
        .withToken(SERVER_TOKEN || undefined)
        .onConnect((conn, identity, token) => {
            console.log('[spacetimedb] Server connected as', identity.toHexString());
            if (!SERVER_TOKEN && token) {
                console.log('[spacetimedb] Set SPACETIMEDB_SERVER_TOKEN=' + token + ' for persistent identity');
            }
        })
        .onConnectError((_conn, err) => {
            console.error('[spacetimedb] Connection error:', err);
            _conn = null;
        })
        .onDisconnect(() => {
            console.warn('[spacetimedb] Disconnected');
            _conn = null;
        })
        .build();

    _conn.subscriptionBuilder().subscribeToAll();
    return _conn;
}

export { tables };
