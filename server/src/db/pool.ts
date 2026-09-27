import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  throw new Error('DATABASE_URL is required; refusing to connect to a default local PostgreSQL database.');
}

export const pool = new Pool({
  connectionString,
  ssl: process.env.DATABASE_SSL === 'true' ? true : undefined
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});
