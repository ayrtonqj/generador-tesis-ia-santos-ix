import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function clean() {
  await p.aIAnalysis.deleteMany();
  await p.advanceChunk.deleteMany();
  await p.advance.deleteMany();
  await p.templateChunk.deleteMany();
  await p.thesisTemplate.deleteMany();
  console.log('Cleaned all test data');
}
clean().catch(console.error).finally(() => p.$disconnect());
