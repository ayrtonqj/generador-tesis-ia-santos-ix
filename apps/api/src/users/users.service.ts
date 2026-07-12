import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { OrcidService } from '../orcid/orcid.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private orcidService: OrcidService,
  ) {}

  async findAll(query: {
    role?: string;
    programId?: string;
    search?: string;
    page?: number;
    limit?: number;
    includeInactive?: boolean;
  }) {
    const where: any = {};

    if (query.role) where.role = query.role as any;
    if (query.programId) where.programId = query.programId;
    if (!query.includeInactive) where.isActive = true;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true, email: true, name: true, role: true,
          programId: true, isActive: true, avatarUrl: true,
          program: { select: { id: true, name: true } },
          advisor: { select: { id: true, name: true } },
          _count: { select: { advisees: true, advances: true } },
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        program: true,
        advisor: { select: { id: true, name: true, email: true } },
        advisees: { select: { id: true, name: true, email: true } },
        orcidProfile: { select: { orcidId: true, displayName: true, keywords: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }

  async create(data: {
    email: string; password: string; name: string;
    role?: string; programId?: string; advisorId?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new BadRequestException('El email ya está registrado');
    }

    if (data.programId) {
      const program = await this.prisma.program.findUnique({
        where: { id: data.programId },
      });
      if (!program) throw new BadRequestException('Programa no encontrado');
    }

    if (data.advisorId) {
      const advisor = await this.prisma.user.findUnique({
        where: { id: data.advisorId },
        select: { role: true },
      });
      if (!advisor) throw new BadRequestException('Asesor no encontrado');
      if (advisor.role !== 'ADVISOR') throw new BadRequestException('El usuario seleccionado no tiene rol de asesor');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: (data.role as any) || 'STUDENT',
        programId: data.programId,
        advisorId: data.advisorId,
      },
      select: {
        id: true, email: true, name: true, role: true,
        programId: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(id: string, data: {
    name?: string; role?: string; programId?: string;
    advisorId?: string; isActive?: boolean;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (data.role && data.role !== user.role) {
      await this.prisma.auditLog.create({
        data: {
          userId: id,
          action: 'ROLE_CHANGE',
          entity: 'User',
          entityId: id,
          metadata: { from: user.role, to: data.role },
        },
      });
    }

    if (data.advisorId) {
      const advisor = await this.prisma.user.findUnique({
        where: { id: data.advisorId },
        select: { role: true },
      });
      if (!advisor) throw new BadRequestException('Asesor no encontrado');
      if (advisor.role !== 'ADVISOR') throw new BadRequestException('El usuario seleccionado no tiene rol de asesor');
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.role !== undefined && { role: data.role as any }),
        ...(data.programId !== undefined && { programId: data.programId }),
        ...(data.advisorId !== undefined && { advisorId: data.advisorId }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      select: {
        id: true, email: true, name: true, role: true,
        programId: true, isActive: true, advisorId: true,
      },
    });
  }

  async softDelete(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.isActive) throw new BadRequestException('El usuario ya está inactivo');

    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'DEACTIVATE_USER',
        entity: 'User',
        entityId: id,
      },
    });

    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, name: true, isActive: true },
    });
  }

  async reactivate(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.isActive) throw new BadRequestException('El usuario ya está activo');

    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'REACTIVATE_USER',
        entity: 'User',
        entityId: id,
      },
    });

    return this.prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, name: true, isActive: true },
    });
  }

  async assignAdvisor(studentId: string, advisorId: string) {
    const student = await this.prisma.user.findUnique({
      where: { id: studentId },
      select: { role: true, programId: true },
    });
    if (!student) throw new NotFoundException('Estudiante no encontrado');
    if (student.role !== 'STUDENT') throw new BadRequestException('El usuario no es un estudiante');

    const advisor = await this.prisma.user.findUnique({
      where: { id: advisorId },
      select: { role: true, programId: true },
    });
    if (!advisor) throw new NotFoundException('Asesor no encontrado');
    if (advisor.role !== 'ADVISOR') throw new BadRequestException('El usuario seleccionado no tiene rol de asesor');

    if (student.programId && advisor.programId && student.programId !== advisor.programId) {
      throw new BadRequestException('El asesor debe pertenecer al mismo programa que el estudiante');
    }

    const result = await this.prisma.user.update({
      where: { id: studentId },
      data: { advisorId },
    });

    this.orcidService.validateAdvisorSuitability(studentId, advisorId).catch(err => {
      this.logger.error('Error en validación cruzada de ORCID:', err);
    });

    return result;
  }

  async bulkAssignAdvisor(studentIds: string[], advisorId: string) {
    const advisor = await this.prisma.user.findUnique({
      where: { id: advisorId },
      select: { role: true },
    });
    if (!advisor) throw new NotFoundException('Asesor no encontrado');
    if (advisor.role !== 'ADVISOR') throw new BadRequestException('El usuario seleccionado no tiene rol de asesor');

    const students = await this.prisma.user.findMany({
      where: { id: { in: studentIds }, role: 'STUDENT' },
      select: { id: true, name: true },
    });

    const foundIds = new Set(students.map(s => s.id));
    const notFound = studentIds.filter(id => !foundIds.has(id));
    if (notFound.length > 0) {
      throw new BadRequestException(`Los siguientes IDs no son estudiantes válidos: ${notFound.join(', ')}`);
    }

    await this.prisma.user.updateMany({
      where: { id: { in: studentIds } },
      data: { advisorId },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: 'system',
        action: 'BULK_ASSIGN_ADVISOR',
        entity: 'User',
        entityId: advisorId,
        metadata: { studentIds, count: studentIds.length },
      },
    });

    return { assigned: studentIds.length, advisorId };
  }

  async resetPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const tempPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: id,
      },
    });

    return { tempPassword, userId: id };
  }

  private generateTempPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password + 'A1!';
  }

  async updateProfile(id: string, data: {
    name?: string;
    signature?: string;
    avatarUrl?: string;
    notifyComplete?: boolean;
    notifyPush?: boolean;
    notifyWeekly?: boolean;
    password?: string;
  }) {
    const updateData: any = {
      ...(data.name && { name: data.name }),
      ...(data.signature !== undefined && { signature: data.signature }),
      ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      ...(data.notifyComplete !== undefined && { notifyComplete: data.notifyComplete }),
      ...(data.notifyPush !== undefined && { notifyPush: data.notifyPush }),
      ...(data.notifyWeekly !== undefined && { notifyWeekly: data.notifyWeekly }),
    };

    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        signature: true,
        notifyComplete: true,
        notifyPush: true,
        notifyWeekly: true,
      }
    });
  }

  async getPrograms() {
    return this.prisma.program.findMany({
      where: { isActive: true },
      include: { _count: { select: { users: true, templates: true } } },
    });
  }

  async updateSettings(id: string, data: Record<string, any>) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    const currentPrefs = (user.preferences as Record<string, any>) || {};
    const merged = { ...currentPrefs, ...data };

    return this.prisma.user.update({
      where: { id },
      data: { preferences: merged },
    });
  }

  async getLoginHistory(userId: string) {
    return this.prisma.loginRecord.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async logoutAllDevices(userId: string) {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'LOGOUT_ALL_DEVICES',
        entity: 'User',
        entityId: userId,
      },
    });
    return { message: 'Sesiones cerradas. Los tokens existentes dejarán de ser válidos al expirar.' };
  }

  async getUsersStats() {
    const [total, active, byRole] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        _count: true,
        where: { isActive: true },
      }),
    ]);

    return {
      total,
      active,
      inactive: total - active,
      byRole: byRole.map(r => ({ role: r.role, count: r._count })),
    };
  }
}
