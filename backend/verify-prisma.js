const { ProductStatus } = require('@prisma/client');
console.log('Valid ProductStatus Ecosystem Values:', Object.values(ProductStatus));
if (Object.values(ProductStatus).includes('REJECTED')) {
  console.log('SUCCESS: REJECTED is now a valid state.');
} else {
  console.log('FAILURE: REJECTED is NOT yet valid. Client update required.');
}
