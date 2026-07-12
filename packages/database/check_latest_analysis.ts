import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const latestAnalysis = await prisma.aIAnalysis.findFirst({
    orderBy: { createdAt: 'desc' },
    include: {
      advance: {
        include: {
          template: true,
        },
      },
      findings: true,
    },
  });

  if (!latestAnalysis) {
    console.log('No analyses found.');
    return;
  }

  console.log('================ LATEST ANALYSIS ================');
  console.log(`ID: ${latestAnalysis.id}`);
  console.log(`Created At: ${latestAnalysis.createdAt}`);
  console.log(`Model Used: ${latestAnalysis.modelUsed}`);
  console.log(`Grade: ${latestAnalysis.gradeConverted}/20`);
  console.log(`Scores: Structure: ${latestAnalysis.structureScore}, Content: ${latestAnalysis.contentScore}, Form: ${latestAnalysis.formScore}, Originality: ${latestAnalysis.originalityScore}`);
  console.log(`Template Name: ${latestAnalysis.advance.template.name}`);
  console.log(`Template Schema: ${JSON.stringify(latestAnalysis.advance.template.extractedSchema, null, 2)}`);
  console.log(`Findings count: ${latestAnalysis.findings.length}`);
  console.log('Findings details:');
  latestAnalysis.findings.forEach(f => {
    console.log(`- [${f.severity}] ${f.sectionRef}: ${f.description.substring(0, 100)}...`);
  });
  console.log('Structure Analysis:', latestAnalysis.structureAnalysis);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
