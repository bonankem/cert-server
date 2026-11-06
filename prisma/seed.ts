/**
 * Seed the database.
 *
 *   npm run db:seed         → create the admin account (idempotent)
 *
 * Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_NAME /
 * SEED_ADMIN_PASSWORD. If no password is set, a strong one is generated and
 * printed once. An existing admin is never overwritten unless
 * SEED_ADMIN_RESET_PASSWORD=true.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { generatePassword, hashPassword, PASSWORD_MIN_LENGTH } from '../src/auth/password.js';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile();
} catch {
  /* use the real environment */
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

async function seedAdmin(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@zoracom.com').trim().toLowerCase();
  const name = process.env.SEED_ADMIN_NAME?.trim() || 'Training Admin';
  const configured = process.env.SEED_ADMIN_PASSWORD?.trim();
  const reset = process.env.SEED_ADMIN_RESET_PASSWORD === 'true';

  if (configured && configured.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`SEED_ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !reset) {
    console.log(`✔ Admin ${email} already exists — left unchanged (set SEED_ADMIN_RESET_PASSWORD=true to reset).`);
    return;
  }

  const password = configured || generatePassword();
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: Role.ADMIN },
    update: { name, passwordHash },
  });
  if (existing) await prisma.session.deleteMany({ where: { userId: existing.id } });

  console.log(`✔ Admin ${existing ? 'password reset' : 'created'}: ${email}`);
  if (!configured) {
    console.log(`  Generated password: ${password}`);
    console.log('  Store it now — it is not saved anywhere. Change it after signing in (Account page).');
  }
}

try {
  await seedAdmin();
} catch (error) {
  console.error('✖ Seed failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
