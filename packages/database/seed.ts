import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Crear programas académicos
  const programs = await Promise.all([
    prisma.program.upsert({
      where: { code: 'MIE' },
      update: {},
      create: {
        name: 'Maestría en Ingeniería de Sistemas',
        code: 'MIE',
        description: 'Programa de maestría en ingeniería de sistemas y computación',
      },
    }),
    prisma.program.upsert({
      where: { code: 'MED' },
      update: {},
      create: {
        name: 'Maestría en Educación',
        code: 'MED',
        description: 'Programa de maestría en ciencias de la educación',
      },
    }),
    prisma.program.upsert({
      where: { code: 'MDR' },
      update: {},
      create: {
        name: 'Maestría en Derecho',
        code: 'MDR',
        description: 'Programa de maestría en derecho constitucional',
      },
    }),
  ]);

  console.log(`✅ ${programs.length} programas creados`);

  // Hash de contraseña común para seeds
  const passwordHash = await bcrypt.hash('Kimy2026!', 12);

  // Crear usuarios
  const ayrton = await prisma.user.upsert({
    where: { email: 'ayrton@kimy.edu' },
    update: {},
    create: {
      email: 'ayrton@kimy.edu',
      passwordHash,
      name: 'Ayrton Quiñones',
      role: Role.ADMIN,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@kimy.edu' },
    update: {},
    create: {
      email: 'admin@kimy.edu',
      passwordHash,
      name: 'Administrador del Sistema',
      role: Role.ADMIN,
    },
  });

  const coordinator = await prisma.user.upsert({
    where: { email: 'coordinador@kimy.edu' },
    update: {},
    create: {
      email: 'coordinador@kimy.edu',
      passwordHash,
      name: 'Dr. Carlos Mendoza',
      role: Role.COORDINATOR,
      programId: programs[0].id,
    },
  });

  const advisor1 = await prisma.user.upsert({
    where: { email: 'asesor1@kimy.edu' },
    update: {},
    create: {
      email: 'asesor1@kimy.edu',
      passwordHash,
      name: 'Dra. María García',
      role: Role.ADVISOR,
      programId: programs[0].id,
    },
  });

  const advisor2 = await prisma.user.upsert({
    where: { email: 'asesor2@kimy.edu' },
    update: {},
    create: {
      email: 'asesor2@kimy.edu',
      passwordHash,
      name: 'Dr. Roberto Sánchez',
      role: Role.ADVISOR,
      programId: programs[1].id,
    },
  });

  const student1 = await prisma.user.upsert({
    where: { email: 'estudiante1@kimy.edu' },
    update: {},
    create: {
      email: 'estudiante1@kimy.edu',
      passwordHash,
      name: 'Ana López Ramírez',
      role: Role.STUDENT,
      programId: programs[0].id,
      advisorId: advisor1.id,
    },
  });

  const student2 = await prisma.user.upsert({
    where: { email: 'estudiante2@kimy.edu' },
    update: {},
    create: {
      email: 'estudiante2@kimy.edu',
      passwordHash,
      name: 'Luis Fernández Torres',
      role: Role.STUDENT,
      programId: programs[0].id,
      advisorId: advisor1.id,
    },
  });

  const student3 = await prisma.user.upsert({
    where: { email: 'estudiante3@kimy.edu' },
    update: {},
    create: {
      email: 'estudiante3@kimy.edu',
      passwordHash,
      name: 'Carmen Ruiz Díaz',
      role: Role.STUDENT,
      programId: programs[1].id,
      advisorId: advisor2.id,
    },
  });

  console.log('✅ 7 usuarios creados (admin, coordinador, 2 asesores, 3 estudiantes)');

  // Crear períodos de entrega
  await prisma.deliveryPeriod.createMany({
    data: [
      {
        programId: programs[0].id,
        name: 'Período 2026-I',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-07-31'),
        isActive: true,
      },
      {
        programId: programs[1].id,
        name: 'Período 2026-I',
        startDate: new Date('2026-03-01'),
        endDate: new Date('2026-07-31'),
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Períodos de entrega creados');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log('  Credenciales de acceso:');
  console.log('  📧 ayrton@kimy.edu       / Kimy2026! (Administrador)');
  console.log('  📧 admin@kimy.edu       / Kimy2026!');
  console.log('  📧 coordinador@kimy.edu / Kimy2026!');
  console.log('  📧 asesor1@kimy.edu     / Kimy2026!');
  console.log('  📧 asesor2@kimy.edu     / Kimy2026!');
  console.log('  📧 estudiante1@kimy.edu / Kimy2026!');
  console.log('  📧 estudiante2@kimy.edu / Kimy2026!');
  console.log('  📧 estudiante3@kimy.edu / Kimy2026!');
  console.log('═══════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
