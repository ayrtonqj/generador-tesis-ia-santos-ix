import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    const advances = await prisma.advance.findMany();
    console.log(`Procesando ${advances.length} avances con lógica DINÁMICA.`);
    
    // Primero limpiar análisis existentes para evitar duplicados
    await prisma.aIAnalysis.deleteMany({});
    
    for (const advance of advances) {
      // Generar scores aleatorios y distintos
      const structure = 40 + Math.random() * 55;
      const content = 40 + Math.random() * 55;
      const form = 30 + Math.random() * 65;
      const originality = 60 + Math.random() * 38;
      const overall = (structure + content + form + originality) / 4;
      const grade = (overall / 100) * 20;
      
      const isObserved = overall < 65;
      const status = isObserved ? 'OBSERVED' : 'AI_COMPLETE';

      console.log(`Inyectando [${status}] (${overall.toFixed(1)}%) para: ${advance.title}`);
      
      await prisma.aIAnalysis.create({
        data: {
          advanceId: advance.id,
          structureScore: structure,
          contentScore: content,
          formScore: form,
          originalityScore: originality,
          overallScore: overall,
          gradeConverted: grade,
          executiveSummary: isObserved 
            ? "RECHAZADO: El documento presenta fallos críticos en la coherencia y el sustento teórico." 
            : "APROBADO CON SUGERENCIAS: El documento cumple la mayoría de criterios pero debe mejorar el formato.",
          processingMs: 1200,
          modelUsed: "gpt-4o-simulated-dynamic",
          findings: {
            create: [
              {
                sectionRef: "Metodología",
                pageRef: 12,
                severity: isObserved ? "CRITICAL" : "MINOR",
                description: isObserved ? "No se especifica el tipo de investigación." : "Mejorar la redacción del muestreo.",
                correctionSteps: "Revisar los estándares de la facultad.",
                exampleImprovement: "La investigación es de tipo...",
                recommendation: "Consultar con el asesor."
              }
            ]
          }
        }
      });
      
      await prisma.advance.update({
        where: { id: advance.id },
        data: { status }
      });
    }
    
    console.log('✅ Base de datos actualizada con resultados variados.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
