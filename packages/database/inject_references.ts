import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    // Limpiar datos anteriores
    await prisma.reference.deleteMany({});
    await prisma.referenceAnalysis.deleteMany({});

    const advances = await prisma.advance.findMany();
    console.log(`Inyectando referencias para ${advances.length} avances...`);

    const sampleRefs = [
      { rawText: 'Fowler, M. (2014). Microservices: a definition of this new architectural term. martinfowler.com', authors: 'Martin Fowler', year: 2014, title: 'Microservices', doi: '10.1145/2904532', status: 'VERIFIED' as const },
      { rawText: 'Hernández Sampieri, R., Fernández, C., & Baptista, P. (2018). Metodología de la investigación (7ma ed.). McGraw-Hill.', authors: 'Hernández Sampieri, R.', year: 2018, title: 'Metodología de la investigación', doi: null, status: 'VERIFIED' as const },
      { rawText: 'Newman, S. (2021). Building Microservices: Designing Fine-Grained Systems (2nd ed.). O\'Reilly Media.', authors: 'Sam Newman', year: 2021, title: 'Building Microservices', doi: '10.1098/rstb.2021.0052', status: 'VERIFIED' as const },
      { rawText: 'García López, J. (2019). Sistemas distribuidos en la nube. Revista de Ingeniería, 45(2), 112-128.', authors: 'García López, J.', year: 2019, title: 'Sistemas distribuidos en la nube', doi: null, status: 'NOT_FOUND' as const },
      { rawText: 'Microsoft Azure (2025). Guía de arquitectura de microservicios. docs.microsoft.com', authors: 'Microsoft', year: 2025, title: 'Guía de arquitectura de microservicios', doi: null, status: 'PARTIAL' as const },
      { rawText: 'Smith, J. & Wang, L. (2023). AI-driven plagiarism detection in academic theses. IEEE Access, 11, 45123-45135.', authors: 'Smith, J. & Wang, L.', year: 2023, title: 'AI-driven plagiarism detection', doi: '10.1109/ACCESS.2023.1234567', status: 'VERIFIED' as const },
      { rawText: 'Rodríguez, P. (2020). Análisis de la calidad del software mediante métricas automatizadas. Tesis doctoral, UNMSM.', authors: 'Rodríguez, P.', year: 2020, title: 'Análisis de la calidad del software', doi: null, status: 'NOT_FOUND' as const },
      { rawText: 'Burns, B. (2022). Designing Distributed Systems. O\'Reilly Media.', authors: 'Brendan Burns', year: 2022, title: 'Designing Distributed Systems', doi: '10.5555/3235404', status: 'VERIFIED' as const },
    ];

    for (const adv of advances) {
      // Seleccionar 4-6 referencias aleatorias para cada avance
      const numRefs = 4 + Math.floor(Math.random() * 3);
      const selectedRefs = [...sampleRefs].sort(() => 0.5 - Math.random()).slice(0, numRefs);

      const verifiedCount = selectedRefs.filter(r => r.status === 'VERIFIED').length;
      const errorCount = selectedRefs.filter(r => r.status === 'NOT_FOUND').length;

      const analysis = await prisma.referenceAnalysis.create({
        data: {
          advanceId: adv.id,
          totalRefs: numRefs,
          verifiedCount,
          errorCount,
          references: {
            create: selectedRefs.map(ref => ({
              rawText: ref.rawText,
              authors: ref.authors,
              year: ref.year,
              title: ref.title,
              doi: ref.doi,
              status: ref.status,
              errorType: ref.status === 'NOT_FOUND' ? 'not_in_crossref' : null,
              suggestion: ref.status === 'NOT_FOUND' ? 'Verificar el título y autor manualmente.' : null,
            })),
          },
        },
      });

      console.log(`  ✓ ${adv.title}: ${numRefs} refs (${verifiedCount} verificadas, ${errorCount} no encontradas)`);
    }

    console.log('\n✅ Datos de referencias inyectados correctamente.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
