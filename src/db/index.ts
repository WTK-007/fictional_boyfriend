import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import * as schema from './schema';

// Node runtime 下用 ws 提供 WebSocket；Edge runtime 会用原生 WebSocket，跳过这步
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const globalForDb = globalThis as unknown as {
  neonPool?: Pool;
};

const pool =
  globalForDb.neonPool ??
  new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.neonPool = pool;
}

export const db = drizzle(pool, { schema });
export { schema };
