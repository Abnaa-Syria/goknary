import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shippingRates = [
  { governorate: 'Cairo', cost: 50 },
  { governorate: 'Giza', cost: 50 },
  { governorate: 'Alexandria', cost: 60 },
  { governorate: 'Qalyubia', cost: 60 },
  { governorate: 'Other Governorates', cost: 100 },
];

async function main() {
  console.log('🌱 Seeding shipping rates...');

  for (const rate of shippingRates) {
    await prisma.shippingRate.upsert({
      where: { governorate: rate.governorate },
      update: { cost: rate.cost, isActive: true },
      create: { governorate: rate.governorate, cost: rate.cost, isActive: true },
    });
  }

  console.log('✅ Shipping rates seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
