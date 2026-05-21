const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Adding payment_method column to orders table...');
    try {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `orders` ADD COLUMN `payment_method` VARCHAR(191) DEFAULT 'COD'"
      );
      console.log('✅ Added payment_method column successfully.');
    } catch (err) {
      if (err.message.includes('Duplicate column name')) {
        console.log('ℹ️ payment_method column already exists.');
      } else {
        throw err;
      }
    }

    console.log('Adding payment_status column to orders table...');
    try {
      await prisma.$executeRawUnsafe(
        "ALTER TABLE `orders` ADD COLUMN `payment_status` VARCHAR(191) DEFAULT 'PENDING'"
      );
      console.log('✅ Added payment_status column successfully.');
    } catch (err) {
      if (err.message.includes('Duplicate column name')) {
        console.log('ℹ️ payment_status column already exists.');
      } else {
        throw err;
      }
    }

    console.log('Database columns updated successfully!');
  } catch (error) {
    console.error('❌ Failed to add columns:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
