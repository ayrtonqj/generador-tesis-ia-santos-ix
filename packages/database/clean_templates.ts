import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.thesisTemplate.deleteMany().then(() => console.log('Deleted all templates')).finally(() => p.$disconnect());
