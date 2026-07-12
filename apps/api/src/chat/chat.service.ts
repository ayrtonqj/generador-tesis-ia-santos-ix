import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI, { toFile } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getProvider, getModelProvider, getAvailableProviders } from '@kimy/ai-engine';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async createConversation(userId: string, title?: string) {
    const conv = await this.prisma.chatConversation.create({
      data: { userId, title: title || 'Nueva conversación' },
    });
    this.logger.log(`[CONVERSACIÓN] Creada: ${conv.id} para usuario ${userId}`);
    return conv;
  }

  async getConversations(userId: string) {
    this.logger.log(`[CONVERSACIONES] Listando para usuario ${userId}`);
    return this.prisma.chatConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getMessages(conversationId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      this.logger.warn(`[MENSAJES] Conversación ${conversationId} no encontrada para usuario ${userId}`);
      throw new NotFoundException('Conversación no encontrada');
    }
    if (conv.userId !== userId) {
      this.logger.warn(`[MENSAJES] Acceso denegado: usuario ${userId} intentó acceder a conversación ${conversationId} de usuario ${conv.userId}`);
      throw new ForbiddenException('No tienes acceso a esta conversación');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    this.logger.log(`[MENSAJES] Cargados ${messages.length} mensajes de conversación ${conversationId}`);
    return messages;
  }

  async deleteConversation(conversationId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.userId !== userId) throw new ForbiddenException('No tienes acceso a esta conversación');

    await this.prisma.chatConversation.delete({ where: { id: conversationId } });
    this.logger.log(`[CONVERSACIÓN] Eliminada: ${conversationId} por usuario ${userId}`);
  }

  async renameConversation(conversationId: string, title: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new NotFoundException('Conversación no encontrada');
    if (conv.userId !== userId) throw new ForbiddenException('No tienes acceso a esta conversación');

    const updated = await this.prisma.chatConversation.update({
      where: { id: conversationId },
      data: { title },
    });
    this.logger.log(`[CONVERSACIÓN] Renombrada: ${conversationId} → "${title}"`);
    return updated;
  }

  private async getActiveConfig(): Promise<{ provider: string; model: string }> {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: 'default' },
    });
    let provider = settings?.aiProvider || process.env.AI_PROVIDER || 'openai';
    let model = settings?.aiModel || process.env.AI_MODEL || 'gpt-4o';

    this.logger.log(`[CONFIG] Desde DB — provider: "${provider}", model: "${model}"`);

    const modelProv = getModelProvider(model);
    if (modelProv) {
      this.logger.log(`[CONFIG] Modelo "${model}" → provider "${modelProv.id}" (inferido del registry)`);
      provider = modelProv.id;
    }

    const def = getProvider(provider);
    if (def) {
      const hasKey = !!process.env[def.apiKeyEnv];
      this.logger.log(`[CONFIG] Resuelto: provider="${provider}", model="${model}", type="${def.type}", apiKeyEnv="${def.apiKeyEnv}", keyPresent=${hasKey}`);
    } else {
      this.logger.warn(`[CONFIG] Provider "${provider}" no encontrado en el registry`);
    }

    return { provider, model };
  }

  private buildOpenAIClient(provider: string) {
    const def = getProvider(provider);
    if (!def || def.type !== 'openai-compatible') {
      this.logger.error(`[OPENAI] Provider "${provider}" no es compatible con OpenAI SDK`);
      throw new Error(`Provider ${provider} no es compatible con OpenAI SDK`);
    }

    const apiKey = process.env[def.apiKeyEnv] || '';
    this.logger.log(`[OPENAI] Cliente creado para "${provider}" → baseURL="${def.baseURL || 'https://api.openai.com/v1'}", apiKeyPresent=${!!apiKey}`);

    return new OpenAI({
      apiKey,
      baseURL: def.baseURL,
    });
  }

  private buildSystemPrompt(institutionName: string, nowLocal: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${nowLocal.getFullYear()}-${pad(nowLocal.getMonth() + 1)}-${pad(nowLocal.getDate())}`;
    const timeStr = `${pad(nowLocal.getHours())}:${pad(nowLocal.getMinutes())}`;
    const weekdays = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const humanDate = `${weekdays[nowLocal.getDay()]} ${nowLocal.getDate()} de ${months[nowLocal.getMonth()]} de ${nowLocal.getFullYear()}`;

    return `Eres KIMY, el asistente inteligente del sistema de revisión de tesis de ${institutionName}.

FECHA Y HORA ACTUAL (hora local Perú, UTC-5): ${humanDate} a las ${timeStr} (${dateStr})
IMPORTANTE SOBRE FECHAS: Los timestamps en la base de datos están almacenados en UTC. Para determinar si algo ocurrió "hoy" o "ayer", SIEMPRE resta 5 horas a los timestamps UTC antes de compararlos con la fecha local indicada arriba. Por ejemplo: un registro con timestamp "2026-06-14T02:30:00Z" equivale al "2026-06-13 21:30" en hora local — es decir, fue ayer, no hoy.

CAPACIDADES:
1. Responder preguntas sobre el sistema KIMY y sus funcionalidades
2. Dar asistencia sobre estructura de tesis, normas APA 7, metodología de investigación
3. Consultar la base de datos en tiempo real para métricas y listados detallados usando las TOOLS disponibles
4. Ayudar con dudas sobre el proceso de revisión de tesis y criterios de evaluación

TOOLS DISPONIBLES (función de base de datos): Puedes consultar la BD cuando te pregunten por:
- Cantidad de tesis aprobadas, rechazadas, observadas, en revisión (Avances)
- Tesis con nota mayor a X
- Promedio de notas de estudiantes
- Estadísticas de tesis generadas con IA (Generador IA)
- Estadísticas globales del sistema (usuarios, programas, generaciones IA, avances)
- Estadísticas por programa académico
- Estudiantes de un asesor
- Listar y buscar avances de tesis detallados con sus títulos, estudiantes, notas y fechas (list_thesis_advances)
- Listar y buscar tesis generadas por IA con sus temas/títulos, usuarios, proveedores y fechas (list_ai_generations)

REGLAS:
- Sé directo y conciso (máximo 3 párrafos salvo que te pidan más detalle)
- Cuando consultes la base de datos, indica explícitamente "Según los datos del sistema..."
- Al mostrar fechas/horas de la BD, convértelas a hora local (UTC-5) antes de presentarlas al usuario
- Usa formato markdown para tablas y listas
- No inventes datos; si necesitas métricas usa las tools
- Si la pregunta está fuera del ámbito académico/de tesis, redirige amablemente`;
  }

  private buildTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
    const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'count_thesis_by_status',
          description: 'Cuenta la cantidad de tesis (avances) en un estado específico',
          parameters: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'],
                description: 'Estado de la tesis',
              },
            },
            required: ['status'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'count_thesis_above_grade',
          description: 'Cuenta tesis con promedio de nota mayor o igual a un valor',
          parameters: {
            type: 'object',
            properties: {
              minGrade: {
                type: 'number',
                description: 'Nota mínima (ej: 14)',
              },
            },
            required: ['minGrade'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_student_stats',
          description: 'Obtiene estadísticas de tesis de un estudiante por su nombre o email',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Nombre o email del estudiante',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_global_stats',
          description: 'Obtiene estadísticas globales del sistema: total tesis, aprobadas, promedio general. Opcionalmente filtra por fecha',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD, opcional)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD, opcional)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_program_stats',
          description: 'Obtiene estadísticas por programa académico',
          parameters: { type: 'object', properties: {} },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_student_average',
          description: 'Obtiene el promedio de notas de un estudiante según sus tesis revisadas',
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Nombre o email del estudiante',
              },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_ai_generation_stats',
          description: 'Obtiene estadísticas de tesis generadas con IA (Generador IA): cantidad total, por proveedor, por estado. Opcionalmente filtra por fecha',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD, opcional)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD, opcional)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_system_overview',
          description: 'Obtiene una vista general completa del sistema: usuarios por rol, programas activos, avances, generaciones IA, promedios de notas. Opcionalmente filtra por fecha',
          parameters: {
            type: 'object',
            properties: {
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD, opcional)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD, opcional)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_generations',
          description: 'Obtiene las tesis generadas con IA de un usuario específico, con filtros opcionales de fecha. Responde con cada generación: tema, proveedor, estado, fecha',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nombre o email del usuario' },
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD, opcional)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD, opcional)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_user_advances_detailed',
          description: 'Obtiene los avances de tesis de un estudiante con filtros opcionales de estado y fecha. Responde con cada avance: título, estado, scores IA, notas humanas, fecha',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Nombre o email del estudiante' },
              status: { type: 'string', enum: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'], description: 'Filtrar por estado (opcional)' },
              startDate: { type: 'string', description: 'Fecha inicio (YYYY-MM-DD, opcional)' },
              endDate: { type: 'string', description: 'Fecha fin (YYYY-MM-DD, opcional)' },
            },
            required: ['query'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'get_recent_activity',
          description: 'Obtiene la actividad reciente del sistema (avances, generaciones IA, usuarios)',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Cantidad de resultados (default 10)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_thesis_advances',
          description: 'Obtiene una lista detallada de avances de tesis con títulos, notas (IA y humana), estados, fechas y datos del estudiante',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Límite de resultados (default 20, max 100)' },
              status: { type: 'string', enum: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'], description: 'Filtrar por estado (opcional)' },
              studentNameOrEmail: { type: 'string', description: 'Filtrar por nombre o email del estudiante (opcional)' },
              minGrade: { type: 'number', description: 'Filtrar por nota mínima (opcional)' },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'list_ai_generations',
          description: 'Obtiene una lista detallada de tesis generadas por la IA con sus temas/títulos, proveedor de IA, estado, fecha y usuario creador',
          parameters: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Límite de resultados (default 20, max 100)' },
              status: { type: 'string', description: 'Filtrar por estado (opcional)' },
              provider: { type: 'string', description: 'Filtrar por proveedor de IA (opcional)' },
              userNameOrEmail: { type: 'string', description: 'Filtrar por nombre o email del creador (opcional)' },
            },
          },
        },
      },
    ];
    return tools;
  }

  private buildAnthropicTools(): Anthropic.Messages.Tool[] {
    const defs = [
      { name: 'count_thesis_by_status', desc: 'Cuenta la cantidad de tesis en un estado específico', props: { status: { type: 'string', enum: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'] } }, req: ['status'] },
      { name: 'count_thesis_above_grade', desc: 'Cuenta tesis con promedio de nota mayor o igual a un valor', props: { minGrade: { type: 'number' } }, req: ['minGrade'] },
      { name: 'get_student_stats', desc: 'Obtiene estadísticas de tesis de un estudiante por su nombre o email', props: { query: { type: 'string' } }, req: ['query'] },
      { name: 'get_global_stats', desc: 'Obtiene estadísticas globales del sistema. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_program_stats', desc: 'Obtiene estadísticas por programa académico', props: {}, req: [] },
      { name: 'get_student_average', desc: 'Obtiene el promedio de notas de un estudiante', props: { query: { type: 'string' } }, req: ['query'] },
      { name: 'get_ai_generation_stats', desc: 'Obtiene estadísticas de tesis generadas con IA. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_system_overview', desc: 'Obtiene vista general completa del sistema. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_user_generations', desc: 'Obtiene las tesis generadas con IA de un usuario específico', props: { query: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } }, req: ['query'] },
      { name: 'get_user_advances_detailed', desc: 'Obtiene los avances de tesis de un estudiante con filtros', props: { query: { type: 'string' }, status: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } }, req: ['query'] },
      { name: 'get_recent_activity', desc: 'Obtiene la actividad reciente del sistema', props: { limit: { type: 'number' } }, req: [] },
      { name: 'list_thesis_advances', desc: 'Obtiene una lista detallada de avances de tesis con títulos, notas, estados, fechas y estudiante', props: { limit: { type: 'number' }, status: { type: 'string' }, studentNameOrEmail: { type: 'string' }, minGrade: { type: 'number' } }, req: [] },
      { name: 'list_ai_generations', desc: 'Obtiene una lista detallada de tesis generadas por la IA con sus temas, proveedor, estado y creador', props: { limit: { type: 'number' }, status: { type: 'string' }, provider: { type: 'string' }, userNameOrEmail: { type: 'string' } }, req: [] },
    ];

    return defs.map(d => ({
      name: d.name,
      description: d.desc,
      input_schema: {
        type: 'object',
        properties: d.props as any,
        required: d.req.length > 0 ? d.req : undefined,
      },
    }));
  }

  private buildGeminiTools() {
    const defs = [
      { name: 'count_thesis_by_status', desc: 'Cuenta la cantidad de tesis en un estado específico', props: { status: { type: 'string', enum: ['PENDING', 'AI_PROCESSING', 'AI_COMPLETE', 'HUMAN_REVIEW', 'OBSERVED', 'APPROVED', 'REJECTED'] } }, req: ['status'] },
      { name: 'count_thesis_above_grade', desc: 'Cuenta tesis con promedio de nota mayor o igual a un valor', props: { minGrade: { type: 'number' } }, req: ['minGrade'] },
      { name: 'get_student_stats', desc: 'Obtiene estadísticas de tesis de un estudiante por su nombre o email', props: { query: { type: 'string' } }, req: ['query'] },
      { name: 'get_global_stats', desc: 'Obtiene estadísticas globales del sistema. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_program_stats', desc: 'Obtiene estadísticas por programa académico', props: {}, req: [] },
      { name: 'get_student_average', desc: 'Obtiene el promedio de notas de un estudiante', props: { query: { type: 'string' } }, req: ['query'] },
      { name: 'get_ai_generation_stats', desc: 'Obtiene estadísticas de tesis generadas con IA. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_system_overview', desc: 'Obtiene vista general completa del sistema. Opcionalmente filtra por fecha', props: { startDate: { type: 'string' }, endDate: { type: 'string' } }, req: [] },
      { name: 'get_user_generations', desc: 'Obtiene las tesis generadas con IA de un usuario específico', props: { query: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } }, req: ['query'] },
      { name: 'get_user_advances_detailed', desc: 'Obtiene los avances de tesis de un estudiante con filtros', props: { query: { type: 'string' }, status: { type: 'string' }, startDate: { type: 'string' }, endDate: { type: 'string' } }, req: ['query'] },
      { name: 'get_recent_activity', desc: 'Obtiene la actividad reciente del sistema', props: { limit: { type: 'number' } }, req: [] },
      { name: 'list_thesis_advances', desc: 'Obtiene una lista detallada de avances de tesis con títulos, notas, estados, fechas y estudiante', props: { limit: { type: 'number' }, status: { type: 'string' }, studentNameOrEmail: { type: 'string' }, minGrade: { type: 'number' } }, req: [] },
      { name: 'list_ai_generations', desc: 'Obtiene una lista detallada de tesis generadas por la IA con sus temas, proveedor, estado y creador', props: { limit: { type: 'number' }, status: { type: 'string' }, provider: { type: 'string' }, userNameOrEmail: { type: 'string' } }, req: [] },
    ];

    return [{
      functionDeclarations: defs.map(d => ({
        name: d.name,
        description: d.desc,
        parameters: {
          type: 'object' as any,
          properties: d.props as any,
          required: d.req.length > 0 ? d.req : undefined,
        },
      })),
    }];
  }

  private toLocalISO(date: Date | string, tzOffsetMinutes = -300): string {
    const utc = new Date(date).getTime();
    const local = new Date(utc + tzOffsetMinutes * 60 * 1000);
    return local.toISOString().replace('T', ' ').substring(0, 16) + ' (hora local)';
  }

  private async executeTool(name: string, args: any): Promise<string> {
    this.logger.log(`[TOOL] Ejecutando: "${name}", args: ${JSON.stringify(args)}`);

    switch (name) {
      case 'count_thesis_by_status': {
        const count = await this.prisma.advance.count({
          where: { status: args.status },
        });
        this.logger.log(`[TOOL] count_thesis_by_status → ${count} tesis en estado "${args.status}"`);
        return JSON.stringify({ count, status: args.status });
      }

      case 'count_thesis_above_grade': {
        const count = await this.prisma.aIAnalysis.count({
          where: { gradeConverted: { gte: args.minGrade } },
        });
        this.logger.log(`[TOOL] count_thesis_above_grade → ${count} tesis con nota >= ${args.minGrade}`);
        return JSON.stringify({ count, minGrade: args.minGrade });
      }

      case 'get_student_stats': {
        this.logger.log(`[TOOL] Buscando estudiante: "${args.query}"`);
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: { contains: args.query, mode: 'insensitive' } },
              { name: { contains: args.query, mode: 'insensitive' } },
            ],
          },
          include: {
            _count: { select: { advances: true } },
            advances: {
              include: { aiAnalysis: true, review: true },
            },
          },
        });
        if (!user) {
          this.logger.warn(`[TOOL] Estudiante no encontrado: "${args.query}"`);
          return JSON.stringify({ error: 'Estudiante no encontrado' });
        }
        const totalAdvances = user.advances.length;
        const aiScores = user.advances.filter(a => a.aiAnalysis).map(a => a.aiAnalysis!.overallScore);
        const humanGrades = user.advances.filter(a => a.review?.finalGrade).map(a => a.review!.finalGrade!);
        this.logger.log(`[TOOL] Estadísticas de "${user.name}": ${totalAdvances} avances, ${aiScores.length} con score IA`);
        return JSON.stringify({
          student: user.name,
          email: user.email,
          totalAdvances,
          avgAIScore: aiScores.length > 0 ? aiScores.reduce((a, b) => a + b, 0) / aiScores.length : null,
          avgHumanGrade: humanGrades.length > 0 ? humanGrades.reduce((a, b) => a + b, 0) / humanGrades.length : null,
        });
      }

      case 'get_student_average': {
        this.logger.log(`[TOOL] Buscando promedio de: "${args.query}"`);
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: { contains: args.query, mode: 'insensitive' } },
              { name: { contains: args.query, mode: 'insensitive' } },
            ],
          },
          include: {
            advances: {
              include: { review: true },
            },
          },
        });
        if (!user) {
          this.logger.warn(`[TOOL] Estudiante no encontrado: "${args.query}"`);
          return JSON.stringify({ error: 'Estudiante no encontrado' });
        }
        const grades = user.advances.filter(a => a.review?.finalGrade).map(a => a.review!.finalGrade!);
        const avg = grades.length > 0 ? grades.reduce((a, b) => a + b, 0) / grades.length : null;
        this.logger.log(`[TOOL] Promedio de "${user.name}": ${avg} (${grades.length} revisiones)`);
        return JSON.stringify({
          student: user.name,
          totalReviewed: grades.length,
          averageGrade: avg,
          grades: grades,
        });
      }

      case 'get_global_stats': {
        const dateWhere: any = {};
        if (args.startDate) dateWhere.gte = new Date(args.startDate);
        if (args.endDate) dateWhere.lte = new Date(args.endDate + 'T23:59:59.999Z');
        const advanceWhere = Object.keys(dateWhere).length ? { createdAt: dateWhere } : {};
        const analysisWhere = Object.keys(dateWhere).length ? { advance: { createdAt: dateWhere } } : {};

        const [total, byStatus, aiAgg] = await Promise.all([
          this.prisma.advance.count({ where: advanceWhere }),
          this.prisma.advance.groupBy({ by: ['status'], where: advanceWhere, _count: { _all: true } }),
          this.prisma.aIAnalysis.aggregate({
            where: analysisWhere,
            _avg: { overallScore: true, gradeConverted: true },
          }),
        ]);
        const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count._all]));
        const result = {
          totalAdvances: total,
          approved: statusMap['APPROVED'] || 0,
          rejected: statusMap['REJECTED'] || 0,
          observed: statusMap['OBSERVED'] || 0,
          pending: (statusMap['PENDING'] || 0) + (statusMap['AI_PROCESSING'] || 0),
          ai_complete: statusMap['AI_COMPLETE'] || 0,
          humanReview: statusMap['HUMAN_REVIEW'] || 0,
          avgOverallScore: Math.round((aiAgg._avg.overallScore || 0) * 10) / 10,
          avgGrade: Math.round((aiAgg._avg.gradeConverted || 0) * 10) / 10,
        };
        this.logger.log(`[TOOL] Stats globales: ${total} tesis, ${result.approved} aprobadas, avgGrade=${result.avgGrade}`);
        return JSON.stringify(result);
      }

      case 'get_program_stats': {
        const programs = await this.prisma.program.findMany({
          where: { isActive: true },
          include: {
            _count: { select: { advances: true, users: true } },
          },
        });
        this.logger.log(`[TOOL] Stats por programa: ${programs.length} programas encontrados`);
        return JSON.stringify(
          programs.map(p => ({
            name: p.name,
            code: p.code,
            totalAdvances: p._count.advances,
            totalUsers: p._count.users,
          }))
        );
      }

      case 'get_ai_generation_stats': {
        const genDateWhere: any = {};
        if (args.startDate) genDateWhere.gte = new Date(args.startDate);
        if (args.endDate) genDateWhere.lte = new Date(args.endDate + 'T23:59:59.999Z');
        const genWhere = Object.keys(genDateWhere).length ? { createdAt: genDateWhere } : {};

        const [total, byProvider, byStatus] = await Promise.all([
          this.prisma.thesisGeneration.count({ where: genWhere }),
          this.prisma.thesisGeneration.groupBy({ by: ['aiProvider'], where: genWhere, _count: { _all: true } }),
          this.prisma.thesisGeneration.groupBy({ by: ['status'], where: genWhere, _count: { _all: true } }),
        ]);
        const result = {
          totalGenerations: total,
          byProvider: Object.fromEntries(byProvider.map(p => [p.aiProvider, p._count._all])),
          byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count._all])),
        };
        this.logger.log(`[TOOL] AI generations: ${total} totales`);
        return JSON.stringify(result);
      }

      case 'get_system_overview': {
        const ovDateWhere: any = {};
        if (args.startDate) ovDateWhere.gte = new Date(args.startDate);
        if (args.endDate) ovDateWhere.lte = new Date(args.endDate + 'T23:59:59.999Z');
        const ovWhere = Object.keys(ovDateWhere).length ? { createdAt: ovDateWhere } : {};

        const [advances, generations, users, programs, aiAgg, reviewAgg] = await Promise.all([
          this.prisma.advance.count({ where: ovWhere }),
          this.prisma.thesisGeneration.count({ where: ovWhere }),
          this.prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
          this.prisma.program.count({ where: { isActive: true } }),
          this.prisma.aIAnalysis.aggregate({
            where: Object.keys(ovDateWhere).length ? { advance: { createdAt: ovDateWhere } } : {},
            _avg: { overallScore: true, gradeConverted: true },
          }),
          this.prisma.review.aggregate({ _avg: { finalGrade: true } }),
        ]);
        const result = {
          totalAdvances: advances,
          totalAiGenerations: generations,
          usersByRole: Object.fromEntries(users.map(u => [u.role, u._count._all])),
          activePrograms: programs,
          avgOverallScore: Math.round((aiAgg._avg.overallScore || 0) * 10) / 10,
          avgAIGrade: Math.round((aiAgg._avg.gradeConverted || 0) * 10) / 10,
          avgHumanGrade: Math.round((reviewAgg._avg.finalGrade || 0) * 10) / 10,
        };
        this.logger.log(`[TOOL] System overview: ${advances} avances, ${generations} generaciones IA, ${programs} programas`);
        return JSON.stringify(result);
      }

      case 'get_user_generations': {
        this.logger.log(`[TOOL] Buscando generaciones de: "${args.query}"`);
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: { contains: args.query, mode: 'insensitive' } },
              { name: { contains: args.query, mode: 'insensitive' } },
            ],
          },
        });
        if (!user) return JSON.stringify({ error: 'Usuario no encontrado' });

        const genWhere: any = { userId: user.id };
        if (args.startDate) genWhere.createdAt = { ...genWhere.createdAt, gte: new Date(args.startDate) };
        if (args.endDate) genWhere.createdAt = { ...genWhere.createdAt, lte: new Date(args.endDate + 'T23:59:59.999Z') };

        const generations = await this.prisma.thesisGeneration.findMany({
          where: genWhere,
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        this.logger.log(`[TOOL] ${generations.length} generaciones encontradas para "${user.name}"`);
        return JSON.stringify({
          userName: user.name,
          total: generations.length,
          generations: generations.map(g => ({
            topic: g.topic,
            provider: g.aiProvider,
            status: g.status,
            sections: g.sectionNames,
            createdAt: this.toLocalISO(g.createdAt),
          })),
        });
      }

      case 'get_user_advances_detailed': {
        this.logger.log(`[TOOL] Buscando avances de: "${args.query}"`);
        const user = await this.prisma.user.findFirst({
          where: {
            OR: [
              { email: { contains: args.query, mode: 'insensitive' } },
              { name: { contains: args.query, mode: 'insensitive' } },
            ],
          },
        });
        if (!user) return JSON.stringify({ error: 'Usuario no encontrado' });

        const advWhere: any = { studentId: user.id };
        if (args.status) advWhere.status = args.status;
        if (args.startDate) advWhere.createdAt = { ...advWhere.createdAt, gte: new Date(args.startDate) };
        if (args.endDate) advWhere.createdAt = { ...advWhere.createdAt, lte: new Date(args.endDate + 'T23:59:59.999Z') };

        const advances = await this.prisma.advance.findMany({
          where: advWhere,
          include: { aiAnalysis: { select: { overallScore: true, gradeConverted: true, modelUsed: true } }, review: { select: { finalGrade: true, status: true } } },
          orderBy: { createdAt: 'desc' },
          take: 50,
        });

        this.logger.log(`[TOOL] ${advances.length} avances encontrados para "${user.name}"`);
        return JSON.stringify({
          userName: user.name,
          total: advances.length,
          advances: advances.map(a => ({
            title: a.title,
            status: a.status,
            aiScore: a.aiAnalysis?.overallScore,
            aiGrade: a.aiAnalysis?.gradeConverted,
            modelUsed: a.aiAnalysis?.modelUsed,
            humanGrade: a.review?.finalGrade,
            reviewStatus: a.review?.status,
            createdAt: this.toLocalISO(a.createdAt),
          })),
        });
      }

      case 'get_recent_activity': {
        const limit = args.limit || 10;
        const [recentAdvances, recentGenerations] = await Promise.all([
          this.prisma.advance.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { student: { select: { name: true } } },
          }),
          this.prisma.thesisGeneration.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true } } },
          }),
        ]);

        const activity: any[] = [
          ...recentAdvances.map(a => ({ type: 'avance', title: a.title, user: a.student.name, status: a.status, createdAt: this.toLocalISO(a.createdAt) })),
          ...recentGenerations.map(g => ({ type: 'generacion_ia', topic: g.topic, user: g.user.name, provider: g.aiProvider, status: g.status, createdAt: this.toLocalISO(g.createdAt) })),
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

        this.logger.log(`[TOOL] Actividad reciente: ${activity.length} eventos`);
        return JSON.stringify({ recentActivity: activity });
      }

      case 'list_thesis_advances': {
        const limit = Math.min(args.limit || 20, 100);
        const where: any = {};
        
        if (args.status) {
          where.status = args.status;
        }
        
        if (args.studentNameOrEmail) {
          where.student = {
            OR: [
              { name: { contains: args.studentNameOrEmail, mode: 'insensitive' } },
              { email: { contains: args.studentNameOrEmail, mode: 'insensitive' } },
            ],
          };
        }
        
        if (args.minGrade !== undefined) {
          where.OR = [
            { aiAnalysis: { gradeConverted: { gte: args.minGrade } } },
            { review: { finalGrade: { gte: args.minGrade } } }
          ];
        }

        const advances = await this.prisma.advance.findMany({
          where,
          include: {
            student: { select: { name: true, email: true } },
            aiAnalysis: { select: { overallScore: true, gradeConverted: true, modelUsed: true } },
            review: { select: { finalGrade: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        this.logger.log(`[TOOL] list_thesis_advances → encontradas ${advances.length} tesis`);
        return JSON.stringify(
          advances.map(a => ({
            id: a.id,
            title: a.title,
            type: a.advanceType,
            version: a.version,
            status: a.status,
            studentName: a.student.name,
            studentEmail: a.student.email,
            aiScore: a.aiAnalysis?.overallScore || null,
            aiGrade: a.aiAnalysis?.gradeConverted || null,
            aiModel: a.aiAnalysis?.modelUsed || null,
            humanGrade: a.review?.finalGrade || null,
            createdAt: this.toLocalISO(a.createdAt),
          }))
        );
      }

      case 'list_ai_generations': {
        const limit = Math.min(args.limit || 20, 100);
        const where: any = {};

        if (args.status) {
          where.status = args.status;
        }

        if (args.provider) {
          where.aiProvider = { contains: args.provider, mode: 'insensitive' };
        }

        if (args.userNameOrEmail) {
          where.user = {
            OR: [
              { name: { contains: args.userNameOrEmail, mode: 'insensitive' } },
              { email: { contains: args.userNameOrEmail, mode: 'insensitive' } },
            ],
          };
        }

        const generations = await this.prisma.thesisGeneration.findMany({
          where,
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: limit,
        });

        this.logger.log(`[TOOL] list_ai_generations → encontradas ${generations.length} generaciones`);
        return JSON.stringify(
          generations.map(g => ({
            id: g.id,
            topic: g.topic,
            provider: g.aiProvider,
            status: g.status,
            userName: g.user.name,
            userEmail: g.user.email,
            createdAt: this.toLocalISO(g.createdAt),
          }))
        );
      }

      default:
        this.logger.warn(`[TOOL] Tool no reconocida: "${name}"`);
        return JSON.stringify({ error: `Tool ${name} no reconocida` });
    }
  }

  async *streamChat(userId: string, conversationId?: string, message?: string): AsyncGenerator<string> {
    const { provider, model } = await this.getActiveConfig();
    const available = getAvailableProviders();
    const def = getProvider(provider);

    this.logger.log(`[STREAM] Iniciando chat — userId="${userId}", conversationId="${conversationId || 'nueva'}", messageLength=${message?.length || 0}`);
    this.logger.log(`[STREAM] Proveedores disponibles: ${JSON.stringify(available)}`);

    if (!available[provider] || !def) {
      this.logger.warn(`[STREAM] Provider "${provider}" no disponible. available=${JSON.stringify(available)}, def=${!!def}`);
      yield JSON.stringify({ type: 'error', content: `El proveedor ${provider} no tiene API key configurada. Ve a Configuración > IA para activarlo.` });
      return;
    }

    const settings = await this.prisma.systemSettings.findUnique({ where: { id: 'default' } });
    const institutionName = settings?.institutionName || 'la institución';
    const tzOffsetMinutes = (settings as any)?.timezoneOffset ?? -300;
    const nowLocal = new Date(Date.now() + tzOffsetMinutes * 60 * 1000);
    const systemPrompt = this.buildSystemPrompt(institutionName, nowLocal);

    let conv = conversationId
      ? await this.prisma.chatConversation.findUnique({ where: { id: conversationId } })
      : null;

    if (conversationId && !conv) {
      this.logger.warn(`[STREAM] Conversación "${conversationId}" no encontrada para usuario ${userId}`);
      yield JSON.stringify({ type: 'error', content: 'Conversación no encontrada' });
      return;
    }

    if (!conv) {
      const convTitle = message ? message.substring(0, 80) : 'Nueva conversación';
      conv = await this.prisma.chatConversation.create({
        data: {
          userId,
          title: convTitle,
          modelUsed: `${provider}/${model}`,
        },
      });
      this.logger.log(`[STREAM] Nueva conversación creada: id="${conv.id}", title="${convTitle}"`);
      yield JSON.stringify({ type: 'conversation_created', conversationId: conv.id });
    } else {
      this.logger.log(`[STREAM] Continuando conversación: id="${conv.id}", title="${conv.title}"`);
    }

    await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'USER',
        content: message || '',
      },
    });
    this.logger.log(`[STREAM] Mensaje de usuario guardado en conversación ${conv.id}`);

    const history = await this.prisma.chatMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 40,
    });
    this.logger.log(`[STREAM] Historial cargado: ${history.length} mensajes previos`);

    this.logger.log(`[STREAM] Usando provider="${provider}" (type="${def.type}"), model="${model}"`);

    try {
      if (def.type === 'anthropic') {
        this.logger.log(`[STREAM] → Delegando a streamChatWithAnthropic()`);
        yield* this.streamChatWithAnthropic(conv, history, systemPrompt, model);
      } else if (provider === 'gemini') {
        this.logger.log(`[STREAM] → Delegando a streamChatWithGemini()`);
        yield* this.streamChatWithGemini(conv, history, systemPrompt, model);
      } else {
        this.logger.log(`[STREAM] → Delegando a streamChatWithOpenAI()`);
        yield* this.streamChatWithOpenAI(conv, history, systemPrompt, provider, model);
      }
    } catch (e: any) {
      this.logger.error(`[STREAM] Error durante streaming: ${e.message}`, e.stack);
      yield JSON.stringify({ type: 'error', content: `Error del proveedor ${provider}: ${e.message}` });
      return;
    }

    await this.prisma.chatConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    const finalMsg = await this.prisma.chatMessage.findFirst({
      where: { conversationId: conv.id, role: 'ASSISTANT' },
      orderBy: { createdAt: 'desc' },
    });

    this.logger.log(`[STREAM] Chat completado: conversationId="${conv.id}", messageId="${finalMsg?.id}"`);
    yield JSON.stringify({ type: 'done', conversationId: conv.id, messageId: finalMsg?.id });
  }

  private async *streamChatWithOpenAI(
    conv: any, history: any[], systemPrompt: string, provider: string, model: string,
  ): AsyncGenerator<string> {
    this.logger.log(`[OPENAI] Streaming iniciado — provider="${provider}", model="${model}"`);

    let openai: OpenAI;
    try {
      openai = this.buildOpenAIClient(provider);
    } catch (e: any) {
      this.logger.error(`[OPENAI] Error creando cliente: ${e.message}`);
      yield JSON.stringify({ type: 'error', content: `Error de configuración: ${e.message}` });
      return;
    }

    const apiMessages: any[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => {
        if (m.role === 'TOOL') {
          return { role: 'tool', tool_call_id: m.toolCalls as any, content: m.content };
        }
        if (m.role === 'ASSISTANT' && m.toolCalls) {
          return { role: 'assistant', content: null, tool_calls: m.toolCalls as any };
        }
        return { role: m.role.toLowerCase(), content: m.content };
      }),
    ];

    this.logger.log(`[OPENAI] Enviando ${apiMessages.length} mensajes a ${model}...`);

    const tools = this.buildTools();
    let response: any;
    try {
      response = await openai.chat.completions.create({
        model,
        messages: apiMessages,
        tools,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      });
    } catch (e: any) {
      this.logger.error(`[OPENAI] Error en la llamada API: ${e.message}`, e.stack);
      yield JSON.stringify({ type: 'error', content: `Error del proveedor ${provider}: ${e.message}` });
      return;
    }

    let fullContent = '';
    let toolCalls: any[] = [];
    let chunkCount = 0;

    try {
      for await (const chunk of response) {
        chunkCount++;
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          yield JSON.stringify({ type: 'text', content: delta.content });
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index;
            if (!toolCalls[idx]) {
              toolCalls[idx] = { id: tc.id || `call_${idx}`, function: { name: '', arguments: '' } };
            }
            if (tc.id) toolCalls[idx].id = tc.id;
            if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
            if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
          }
        }
      }
    } catch (e: any) {
      this.logger.error(`[OPENAI] Error durante streaming de chunks: ${e.message}`);
      yield JSON.stringify({ type: 'error', content: `Error de streaming: ${e.message}` });
      return;
    }

    this.logger.log(`[OPENAI] Streaming completado — ${chunkCount} chunks recibidos, ${toolCalls.length} tool_calls detectados, contentLength=${fullContent.length}`);

    if (toolCalls.length > 0) {
      const validCalls = toolCalls.filter(tc => tc.function?.name);
      this.logger.log(`[OPENAI] Ejecutando ${validCalls.length} tool(s): ${validCalls.map(t => t.function.name).join(', ')}`);
      yield JSON.stringify({ type: 'tool_calls', content: validCalls });

      await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: fullContent || '',
          toolCalls: validCalls as any,
        },
      });

      for (const tc of validCalls) {
        let result: string;
        try {
          const args = JSON.parse(tc.function.arguments);
          this.logger.log(`[OPENAI] Ejecutando tool "${tc.function.name}" con args=${JSON.stringify(args)}`);
          result = await this.executeTool(tc.function.name, args);
          this.logger.log(`[OPENAI] Tool "${tc.function.name}" resultado: ${result.substring(0, 200)}`);
        } catch (e: any) {
          this.logger.error(`[OPENAI] Error ejecutando tool "${tc.function.name}": ${e.message}`);
          result = JSON.stringify({ error: `Error ejecutando ${tc.function.name}: ${e.message}` });
        }
        yield JSON.stringify({ type: 'tool_result', toolCallId: tc.id, content: result });

        apiMessages.push({
          role: 'assistant',
          content: null,
          tool_calls: [{ id: tc.id, type: 'function', function: { name: tc.function.name, arguments: tc.function.arguments } }],
        });
        apiMessages.push({ role: 'tool', tool_call_id: tc.id, content: result });
      }

      this.logger.log(`[OPENAI] Enviando segunda pasada con resultados de tools...`);
      try {
        const secondResponse = await openai.chat.completions.create({
          model,
          messages: apiMessages,
          stream: true,
          temperature: 0.7,
          max_tokens: 2048,
        });

        fullContent = '';
        let secondChunkCount = 0;
        for await (const chunk of secondResponse) {
          secondChunkCount++;
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullContent += delta.content;
            yield JSON.stringify({ type: 'text', content: delta.content });
          }
        }
        this.logger.log(`[OPENAI] Segunda pasada completada: ${secondChunkCount} chunks, contentLength=${fullContent.length}`);
      } catch (e: any) {
        this.logger.error(`[OPENAI] Error en segunda pasada: ${e.message}`);
      }
    }

    this.logger.log(`[OPENAI] Guardando mensaje del asistente (contentLength=${fullContent.length})`);
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content: fullContent || '',
      },
    });
    this.logger.log(`[OPENAI] Mensaje guardado exitosamente`);
  }

  private async *streamChatWithGemini(
    conv: any, history: any[], systemPrompt: string, model: string,
  ): AsyncGenerator<string> {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.logger.log(`[GEMINI] Streaming iniciado — model="${model}", keyPresent=${!!apiKey}`);

    if (!apiKey) {
      this.logger.error(`[GEMINI] API key no configurada`);
      yield JSON.stringify({ type: 'error', content: 'API key de Gemini no configurada' });
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const geminiModel = genAI.getGenerativeModel(
      { model },
      { apiVersion: 'v1beta' },
    );

    const tools = this.buildGeminiTools();

    const historyContents: { role: 'user' | 'model'; parts: any[] }[] = [];
    let isFirstMessage = true;

    for (const m of history) {
      if (m.role === 'USER') {
        if (isFirstMessage) {
          historyContents.push({
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${m.content}` }],
          });
          isFirstMessage = false;
        } else {
          historyContents.push({ role: 'user', parts: [{ text: m.content }] });
        }
      } else if (m.role === 'ASSISTANT' && m.toolCalls) {
        historyContents.push({
          role: 'model',
          parts: (m.toolCalls as any[]).map((tc: any) => ({
            functionCall: { name: tc.name || tc.function?.name, args: tc.input || JSON.parse(tc.function?.arguments || '{}') },
          })),
        });
      } else if (m.role === 'ASSISTANT' && m.content) {
        historyContents.push({ role: 'model', parts: [{ text: m.content }] });
      }
    }

    let fullContent = '';
    let currentContents = [...historyContents];

    try {
      this.logger.log(`[GEMINI] Enviando ${currentContents.length} mensajes a Gemini API con tools...`);

      const result = await geminiModel.generateContentStream({
        contents: currentContents,
        tools,
        generationConfig: { maxOutputTokens: 32768 },
      });

      let chunkCount = 0;
      let functionCalls: any[] = [];

      for await (const chunk of result.stream) {
        chunkCount++;
        const text = chunk.text();
        if (text) {
          fullContent += text;
          yield JSON.stringify({ type: 'text', content: text });
        }
      }

      const aggregated = await result.response;
      const fcs = aggregated.functionCalls();
      functionCalls = fcs || [];

      this.logger.log(`[GEMINI] Streaming completado: ${chunkCount} chunks, ${functionCalls.length} function calls, contentLength=${fullContent.length}`);

      if (functionCalls.length > 0) {
        this.logger.log(`[GEMINI] Ejecutando ${functionCalls.length} function(s): ${functionCalls.map((fc: any) => fc.name).join(', ')}`);
        yield JSON.stringify({ type: 'tool_calls', content: functionCalls });

        const results: string[] = [];

        for (const fc of functionCalls) {
          let resultStr: string;
          try {
            this.logger.log(`[GEMINI] Ejecutando tool "${fc.name}" con args=${JSON.stringify(fc.args)}`);
            resultStr = await this.executeTool(fc.name, fc.args);
            this.logger.log(`[GEMINI] Tool "${fc.name}" resultado: ${resultStr.substring(0, 200)}`);
          } catch (e: any) {
            this.logger.error(`[GEMINI] Error ejecutando tool "${fc.name}": ${e.message}`);
            resultStr = JSON.stringify({ error: `Error ejecutando ${fc.name}: ${e.message}` });
          }

          yield JSON.stringify({ type: 'tool_result', toolCallId: fc.name, content: resultStr });
          results.push(`Resultado de ${fc.name}: ${resultStr}`);
        }

        currentContents.push({ role: 'user', parts: [{ text: results.join('\n\n') }] });

        this.logger.log(`[GEMINI] Enviando segunda pasada con resultados en texto plano...`);

        fullContent = '';
        let secondChunkCount = 0;

        const secondResult = await geminiModel.generateContentStream({
          contents: currentContents,
          generationConfig: { maxOutputTokens: 32768 },
        });

        for await (const chunk of secondResult.stream) {
          secondChunkCount++;
          const text = chunk.text();
          if (text) {
            fullContent += text;
            yield JSON.stringify({ type: 'text', content: text });
          }
        }

        this.logger.log(`[GEMINI] Segunda pasada completada: ${secondChunkCount} chunks, contentLength=${fullContent.length}`);
      }
    } catch (e: any) {
      this.logger.error(`[GEMINI] Error durante streaming: ${e.message}`, e.stack);
      yield JSON.stringify({ type: 'error', content: `Error de Gemini: ${e.message}` });
      return;
    }

    this.logger.log(`[GEMINI] Guardando mensaje del asistente (contentLength=${fullContent.length})`);
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content: fullContent || '',
      },
    });
    this.logger.log(`[GEMINI] Mensaje guardado exitosamente`);
  }

  private async *streamChatWithAnthropic(
    conv: any, history: any[], systemPrompt: string, model: string,
  ): AsyncGenerator<string> {
    const apiKey = process.env.CLAUDE_API_KEY || '';
    this.logger.log(`[CLAUDE] Streaming iniciado — model="${model}", keyPresent=${!!apiKey}`);

    if (!apiKey) {
      this.logger.error(`[CLAUDE] API key no configurada`);
      yield JSON.stringify({ type: 'error', content: 'API key de Claude no configurada' });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const tools = this.buildAnthropicTools();

    const claudeMessages: Anthropic.Messages.MessageParam[] = history
      .filter(m => m.role === 'USER' || m.role === 'ASSISTANT')
      .map(m => ({ role: m.role.toLowerCase() as 'user' | 'assistant', content: m.content }));

    this.logger.log(`[CLAUDE] Enviando ${claudeMessages.length} mensajes a Claude API...`);

    let stream: any;
    try {
      stream = anthropic.messages.stream({
        model,
        system: systemPrompt,
        messages: claudeMessages,
        tools: tools.length > 0 ? tools : undefined,
        max_tokens: 2048,
      });
    } catch (e: any) {
      this.logger.error(`[CLAUDE] Error iniciando stream: ${e.message}`, e.stack);
      yield JSON.stringify({ type: 'error', content: `Error de Claude: ${e.message}` });
      return;
    }

    let fullContent = '';
    let eventCount = 0;

    try {
      for await (const event of stream) {
        eventCount++;
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          fullContent += event.delta.text;
          yield JSON.stringify({ type: 'text', content: event.delta.text });
        }
      }
    } catch (e: any) {
      this.logger.error(`[CLAUDE] Error durante streaming de eventos: ${e.message}`);
      yield JSON.stringify({ type: 'error', content: `Error de streaming Claude: ${e.message}` });
      return;
    }

    this.logger.log(`[CLAUDE] Primera respuesta completada: ${eventCount} eventos, contentLength=${fullContent.length}`);

    let finalMessage: any;
    try {
      finalMessage = await stream.finalMessage();
    } catch (e: any) {
      this.logger.error(`[CLAUDE] Error obteniendo finalMessage: ${e.message}`);
      yield JSON.stringify({ type: 'error', content: `Error finalizando Claude: ${e.message}` });
      return;
    }

    const toolUses = finalMessage.content.filter((c: any) => c.type === 'tool_use');
    this.logger.log(`[CLAUDE] Herramientas solicitadas: ${toolUses.length}`);

    if (toolUses.length > 0) {
      this.logger.log(`[CLAUDE] Ejecutando ${toolUses.length} tool(s): ${toolUses.map((t: any) => t.name).join(', ')}`);

      await this.prisma.chatMessage.create({
        data: {
          conversationId: conv.id,
          role: 'ASSISTANT',
          content: fullContent || '',
          toolCalls: toolUses as any,
        },
      });

      const followUpMessages: Anthropic.Messages.MessageParam[] = [
        ...claudeMessages,
        { role: 'assistant', content: finalMessage.content },
        { role: 'user', content: [] as any },
      ];

      for (const tu of toolUses) {
        let result: string;
        try {
          this.logger.log(`[CLAUDE] Ejecutando tool "${tu.name}" con input=${JSON.stringify(tu.input)}`);
          result = await this.executeTool(tu.name, tu.input);
          this.logger.log(`[CLAUDE] Tool "${tu.name}" resultado: ${result.substring(0, 200)}`);
        } catch (e: any) {
          this.logger.error(`[CLAUDE] Error ejecutando tool "${tu.name}": ${e.message}`);
          result = JSON.stringify({ error: `Error ejecutando ${tu.name}: ${e.message}` });
        }
        yield JSON.stringify({ type: 'tool_result', toolCallId: tu.id, content: result });

        (followUpMessages[followUpMessages.length - 1].content as any).push({
          type: 'tool_result',
          tool_use_id: tu.id,
          content: result,
        });
      }

      this.logger.log(`[CLAUDE] Enviando segunda pasada con resultados de tools...`);
      fullContent = '';
      let secondEventCount = 0;

      try {
        const secondStream = anthropic.messages.stream({
          model,
          system: systemPrompt,
          messages: followUpMessages,
          max_tokens: 2048,
        });

        for await (const event of secondStream) {
          secondEventCount++;
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullContent += event.delta.text;
            yield JSON.stringify({ type: 'text', content: event.delta.text });
          }
        }
        this.logger.log(`[CLAUDE] Segunda pasada completada: ${secondEventCount} eventos, contentLength=${fullContent.length}`);
      } catch (e: any) {
        this.logger.error(`[CLAUDE] Error en segunda pasada: ${e.message}`);
      }
    }

    this.logger.log(`[CLAUDE] Guardando mensaje del asistente (contentLength=${fullContent.length})`);
    await this.prisma.chatMessage.create({
      data: {
        conversationId: conv.id,
        role: 'ASSISTANT',
        content: fullContent || '',
      },
    });
    this.logger.log(`[CLAUDE] Mensaje guardado exitosamente`);
  }

  async transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string> {
    this.logger.log(`[STT] Iniciando transcripción — mimeType="${mimeType}", bytes=${audioBuffer.length}`);

    const ext = mimeType.includes('ogg') ? 'ogg' : mimeType.includes('mp4') ? 'mp4' : 'webm';
    const filename = `audio.${ext}`;

    if (process.env.OPENAI_API_KEY) {
      this.logger.log(`[STT] Usando OpenAI Whisper`);
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const file = await toFile(audioBuffer, filename, { type: mimeType });
        const result = await openai.audio.transcriptions.create({
          model: 'whisper-1',
          file,
          language: 'es',
        });
        this.logger.log(`[STT] OpenAI Whisper OK — transcript="${result.text.substring(0, 80)}"`);
        return result.text;
      } catch (e: any) {
        this.logger.error(`[STT] OpenAI Whisper falló: ${e.message}. Intentando Groq...`);
      }
    }

    if (process.env.GROQ_API_KEY) {
      this.logger.log(`[STT] Usando Groq Whisper`);
      try {
        const groq = new OpenAI({ apiKey: process.env.GROQ_API_KEY, baseURL: 'https://api.groq.com/openai/v1' });
        const file = await toFile(audioBuffer, filename, { type: mimeType });
        const result = await groq.audio.transcriptions.create({
          model: 'whisper-large-v3-turbo',
          file,
          language: 'es',
        });
        this.logger.log(`[STT] Groq Whisper OK — transcript="${result.text.substring(0, 80)}"`);
        return result.text;
      } catch (e: any) {
        this.logger.error(`[STT] Groq Whisper falló: ${e.message}`);
        throw new Error('No se pudo transcribir el audio. Configura OPENAI_API_KEY o GROQ_API_KEY.');
      }
    }

    this.logger.warn(`[STT] Sin API keys para STT (OPENAI_API_KEY o GROQ_API_KEY requeridas)`);
    throw new Error('Sin API keys para transcripción. Configura OPENAI_API_KEY o GROQ_API_KEY en Settings.');
  }

  async generateSpeech(text: string): Promise<Buffer> {
    const { provider } = await this.getActiveConfig();
    const cleanedText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Quitar enlaces, dejar solo texto
      .replace(/[*_`#]/g, '') // Quitar asteriscos, guiones bajos, comillas invertidas, hashtags
      .replace(/-\s+/g, '') // Quitar guiones de viñeta
      .replace(/\|\s*/g, ' ') // Reemplazar barras de tablas
      .replace(/\s+/g, ' ') // Colapsar espacios y saltos de línea
      .trim();

    const textPreview = cleanedText.substring(0, 80);
    this.logger.log(`[TTS] Iniciando — provider="${provider}", textLength=${text.length}, cleanedLength=${cleanedText.length}, preview="${textPreview}..."`);

    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      this.logger.log(`[TTS] Usando OpenAI TTS (model=tts-1-hd, voice=nova)`);
      try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const response = await openai.audio.speech.create({
          model: 'tts-1-hd',
          voice: 'nova',
          input: cleanedText.substring(0, 4096),
        });
        const buffer = Buffer.from(await response.arrayBuffer());
        this.logger.log(`[TTS] OpenAI TTS completado: ${buffer.length} bytes`);
        return buffer;
      } catch (e: any) {
        this.logger.error(`[TTS] OpenAI TTS falló: ${e.message}. Usando fallback Google TTS...`);
      }
    }

    this.logger.log(`[TTS] Usando Google Translate TTS (gratuito)`);
    try {
      // Google Translate TTS tiene un límite estricto de 200 caracteres por petición.
      // Dividimos el texto limpio en bloques de hasta 200 caracteres sin cortar palabras.
      const chunks: string[] = [];
      let current = '';
      const words = cleanedText.split(' ');
      for (const word of words) {
        if ((current + ' ' + word).trim().length <= 200) {
          current = (current + ' ' + word).trim();
        } else {
          if (current) chunks.push(current);
          current = word;
        }
      }
      if (current) chunks.push(current);

      this.logger.log(`[TTS] Google TTS segmentó el texto en ${chunks.length} bloques`);
      const buffers: Buffer[] = [];
      for (const chunk of chunks) {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=es&client=tw-ob&q=${encodeURIComponent(chunk)}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          throw new Error(`Google TTS falló con estado ${resp.status}`);
        }
        buffers.push(Buffer.from(await resp.arrayBuffer()));
      }

      const buffer = Buffer.concat(buffers);
      this.logger.log(`[TTS] Google TTS completado: ${buffer.length} bytes combinados`);
      return buffer;
    } catch (e: any) {
      this.logger.error(`[TTS] Google TTS falló: ${e.message}`);
      throw e;
    }
  }
}
