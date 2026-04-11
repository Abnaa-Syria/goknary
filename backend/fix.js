const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function fixMySQLQuirk() {
  try {
    const result = await prisma.$executeRawUnsafe(`UPDATE Product SET status = 'APPROVED' WHERE status = '' OR status IS NULL`);
    fs.writeFileSync('db-fix-result.txt', `Success! Rows updated: ${result}`);
  } catch (err) {
    fs.writeFileSync('db-fix-result.txt', `Error: ${err.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

fixMySQLQuirk();
