const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixEmptyStatuses() {
  try {
    console.log('--- DB STATUS PATCH ---');
    // In MySQL, invalid enums sometimes get saved as ''
    const result = await prisma.$executeRawUnsafe(`UPDATE Product SET status = 'DRAFT' WHERE status = '' OR status IS NULL`);
    console.log(`SUCCESS: Patched ${result} products with empty status values.`);
  } catch (error) {
    console.error('FAILURE: Patch failed!', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixEmptyStatuses();
