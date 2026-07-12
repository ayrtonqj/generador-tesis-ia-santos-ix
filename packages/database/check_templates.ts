import { PrismaClient } from '@prisma/client';
async function run() {
  const p = new PrismaClient();
  const templates = await p.thesisTemplate.findMany();
  console.log('Templates encontrados:', templates.length);
  templates.forEach(t => console.log('  -', t.id, t.name, 'v'+t.version));
  await p.$disconnect();
}
run();
