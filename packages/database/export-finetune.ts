import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function exportToJSONL() {
  console.log('🔄 Iniciando exportación de dataset de Fine-Tuning...');

  // 1. Obtener todos los pares aprobados con correcciones humanas
  const pairs = await prisma.fineTuningPair.findMany({
    where: {
      outcomeType: 'ACCEPTED_WITH_EDIT',
    },
    include: {
      finding: {
        include: {
          analysis: {
            include: {
              advance: {
                include: {
                  template: true
                }
              }
            }
          }
        }
      }
    }
  });

  if (pairs.length === 0) {
    console.log('⚠️ No se encontraron pares de fine-tuning aceptados con edición en la base de datos.');
    return;
  }

  const jsonlLines: string[] = [];

  for (const pair of pairs) {
    const advance = pair.finding.analysis.advance;
    
    const systemPrompt = `Eres un evaluador académico experto en tesis universitarias de posgrado. Tu tarea es analizar un avance de tesis comparándolo contra un documento patrón institucional. Responde ÚNICAMENTE con JSON válido.`;
    
    // Reconstruir el input del usuario (User Prompt)
    const userContent = `Evalúa el siguiente documento.\n\nTIPO DE AVANCE: ${pair.advanceType}\n\nESQUEMA PATRÓN:\n${JSON.stringify(advance.template.extractedSchema)}\n\nDOCUMENTO DEL ESTUDIANTE:\n${advance.extractedText?.substring(0, 5000) || 'Texto no disponible...'}`;

    // La salida corregida por el humano (Assistant Output)
    const assistantContent = JSON.stringify(pair.humanCorrection);

    // Formato estricto de Chat de OpenAI
    const openAILine = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
        { role: 'assistant', content: assistantContent }
      ]
    };

    jsonlLines.push(JSON.stringify(openAILine));
  }

  // 2. Escribir el archivo
  const outputPath = path.join(process.cwd(), 'finetuning-dataset.jsonl');
  fs.writeFileSync(outputPath, jsonlLines.join('\n'));

  console.log(`✅ Exportación exitosa! Se han exportado ${pairs.length} ejemplos a:`);
  console.log(`📁 ${outputPath}`);
  console.log('\nComando para subir a OpenAI:');
  console.log(`curl https://api.openai.com/v1/files \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -F purpose="fine-tune" \\
  -F file="@finetuning-dataset.jsonl"`);
}

exportToJSONL()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
