const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

// Cierre limpio al apagar el proceso
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = prisma;
