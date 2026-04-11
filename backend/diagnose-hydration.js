const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHydration() {
  try {
    console.log('--- HYDRATION TEST ---');
    const products = await prisma.product.findMany({ take: 5 });
    console.log('SUCCESS: Products hydrated successfully.');
    console.log('Sample Data:', products.map(p => ({ id: p.id, status: p.status })));
  } catch (error) {
    console.error('FAILURE: Hydration failed!', error.message);
    if (error.message.includes('variant')) {
      console.log('CONFIRMED: Enum mismatch between DB and Generated Client.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkHydration();
