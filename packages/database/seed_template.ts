import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function seed() {
  const progs = await p.program.findMany();
  for (const prog of progs) {
    await p.thesisTemplate.create({ 
      data: { 
        programId: prog.id, 
        name: `Formato APA 7 - ${prog.code}`, 
        version: '1.0', 
        fileKey: 'dummy/path.pdf',
        fileType: 'application/pdf',
        isActive: true, 
        rubric: { structure: 30, content: 40, style: 15, originality: 15 } 
      } 
    });
  }
  console.log('Templates created for all programs');
}

seed().catch(console.error).finally(()=>p.$disconnect());
