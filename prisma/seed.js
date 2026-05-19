const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de GESTAR ERP...');

  // Crear rol ADMIN
  const rolAdmin = await prisma.rol.upsert({
    where: { nombre: 'ADMIN' },
    update: {},
    create: {
      nombre: 'ADMIN',
      descripcion: 'Administrador con acceso total',
      permisos: { todo: true },
    },
  });

  // Crear empresa GestarSoft
  const empresa = await prisma.empresa.upsert({
    where: { ruc: '000-000-00000' },
    update: {},
    create: {
      ruc: '000-000-00000',
      nombre: 'GestarSoft',
      nombreComercial: 'GestarSoft',
      email: 'admin@gestarsoft.com',
      plan: 'TRIAL',
      trialVence: new Date('2099-12-31'),
    },
  });

  // Crear usuario admin
  const passwordHash = await bcrypt.hash('GestarSoft2026!', 10);
  const usuario = await prisma.usuario.upsert({
    where: { email: 'admin@gestarsoft.com' },
    update: { password: passwordHash },
    create: {
      empresaId: empresa.id,
      rolId: rolAdmin.id,
      nombre: 'Administrador',
      email: 'admin@gestarsoft.com',
      password: passwordHash,
    },
  });

  console.log('Admin creado:', usuario.email);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
