import { prisma } from '../lib/prisma';

const ensurePhoneVerifiedColumn = async () => {
  await prisma.$executeRawUnsafe(
    'ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phone_verified` BOOLEAN NOT NULL DEFAULT false'
  );
};

const main = async () => {
  try {
    await ensurePhoneVerifiedColumn();
    console.log('[bootstrap-db] ensured users.phone_verified exists');
  } finally {
    await prisma.$disconnect();
  }
};

main().catch((error) => {
  console.error('[bootstrap-db] failed:', error);
  process.exit(1);
});
