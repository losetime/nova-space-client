import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let connectionString: string;
if (process.env.DB_NAME) {
  connectionString = `postgres://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
} else {
  connectionString = 'postgres://postgres:postgres@localhost:5432/nova_space';
}

const client = postgres(connectionString, { max: 10 });

export const db = drizzle(client, { schema });

export type DrizzleClient = ReturnType<typeof drizzle>;

export { schema };
