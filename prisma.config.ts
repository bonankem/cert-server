import { defineConfig } from 'prisma/config';

// Load server/.env for the Prisma CLI (Node built-in; no dotenv dependency).
try {
  process.loadEnvFile();
} catch {
  /* no .env — use the real environment */
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
