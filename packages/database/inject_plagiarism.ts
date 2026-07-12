import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    // Limpiar reportes antiguos
    await prisma.plagiarismAlert.deleteMany({});
    await prisma.plagiarismReport.deleteMany({});
    
    const advances = await prisma.advance.findMany();
    console.log(`Inyectando plagio para ${advances.length} avances...`);

    for (const adv of advances) {
      const similarity = 10 + Math.random() * 35; // 10% - 45%

      const report = await prisma.plagiarismReport.create({
        data: {
          advanceId: adv.id,
          method: 'EMBEDDINGS_COSINE',
          overallScore: similarity,
          status: 'done',
        },
      });

      // Crear alertas simuladas
      const alertSources = [
        {
          sectionName: 'Marco Teórico',
          similarity: 0.75 + Math.random() * 0.2,
          sourceSnippet: 'La arquitectura de microservicios permite descomponer aplicaciones monolíticas en servicios independientes que se comunican mediante APIs REST...',
          targetSnippet: 'Se propone una arquitectura basada en microservicios para descomponer la aplicación monolítica en servicios independientes...',
          severity: 'critical',
        },
        {
          sectionName: 'Metodología',
          similarity: 0.55 + Math.random() * 0.2,
          sourceSnippet: 'Se empleó un diseño de investigación no experimental, transversal, de alcance descriptivo correlacional...',
          targetSnippet: 'La investigación tiene un diseño no experimental transversal con alcance descriptivo-correlacional...',
          severity: 'warning',
        },
        {
          sectionName: 'Antecedentes',
          similarity: 0.40 + Math.random() * 0.2,
          sourceSnippet: 'Según estudios previos realizados en universidades de Latinoamérica, la adopción de tecnologías cloud...',
          targetSnippet: 'Investigaciones anteriores en universidades latinoamericanas sobre adopción de tecnologías en la nube...',
          severity: 'warning',
        },
      ];

      // Tomar 2-3 alertas aleatorias
      const numAlerts = 2 + Math.floor(Math.random() * 2);
      const selected = alertSources.slice(0, numAlerts);

      for (const alert of selected) {
        await prisma.plagiarismAlert.create({
          data: {
            reportId: report.id,
            targetAdvanceId: null,
            sectionName: alert.sectionName,
            similarity: alert.similarity,
            sourceSnippet: alert.sourceSnippet,
            targetSnippet: alert.targetSnippet,
            severity: alert.severity,
          },
        });
      }

      console.log(`  ✓ ${adv.title}: ${similarity.toFixed(1)}% similitud, ${numAlerts} alertas`);
    }

    console.log('\n✅ Datos de plagio inyectados correctamente.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
