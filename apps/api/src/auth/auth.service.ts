import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  private recoveryTokens = new Map<string, { userId: string; expires: number }>();
  private loginAttempts = new Map<string, { count: number; blockedUntil: number }>();
  private temp2faSecrets = new Map<string, { secret: string; email: string; expires: number }>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Limpiar secrets 2FA expirados cada 5 minutos
    setInterval(() => {
      const now = Date.now();
      for (const [key, val] of this.temp2faSecrets.entries()) {
        if (val.expires < now) this.temp2faSecrets.delete(key);
      }
    }, 300_000);
  }

  async login(email: string, password: string, ip?: string, userAgent?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { program: { select: { name: true } } },
    });

    // Verificar bloqueo por intentos fallidos
    const attemptKey = `login:${email}`;
    const attempt = this.loginAttempts.get(attemptKey);
    if (attempt && Date.now() < attempt.blockedUntil) {
      throw new ForbiddenException('Cuenta bloqueada temporalmente por múltiples intentos fallidos. Intenta de nuevo en 15 minutos.');
    }

    if (!user || !user.isActive) {
      // Registrar intento fallido para evadir enumeración de usuarios
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      this.recordFailedAttempt(attemptKey);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    // Limpiar intentos fallidos en login exitoso
    this.loginAttempts.delete(attemptKey);

    // Registrar el login
    if (ip) {
      await this.prisma.loginRecord.create({
        data: { userId: user.id, ip: ip || 'unknown', userAgent: userAgent || null },
      }).catch(() => {});
    }

    // Si el usuario tiene 2FA activo, devolver tempToken
    if (user.twoFactorSecret) {
      const tempToken = this.jwtService.sign(
        { sub: user.id, type: '2fa_temp' },
        { expiresIn: '5m' },
      );
      return {
        requires2fa: true,
        tempToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      programId: user.programId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        programId: user.programId,
        programName: user.program?.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  private recordFailedAttempt(key: string) {
    const existing = this.loginAttempts.get(key);
    const count = (existing?.count || 0) + 1;
    const blockedUntil = count >= 5 ? Date.now() + 15 * 60 * 1000 : 0;
    this.loginAttempts.set(key, { count, blockedUntil });
  }

  async register(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
    programId?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new BadRequestException('El email ya está registrado');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        role: (data.role as any) || 'STUDENT',
        programId: data.programId,
      },
    });

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      programId: user.programId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        programId: user.programId,
      },
    };
  }

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        programId: true,
        isActive: true,
        avatarUrl: true,
        signature: true,
        notifyComplete: true,
        notifyPush: true,
        notifyWeekly: true,
        twoFactorSecret: true,
      },
    });
    if (!user) return null;
    const { twoFactorSecret, ...rest } = user;
    return { ...rest, twoFactorEnabled: !!twoFactorSecret };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Contraseña actual incorrecta');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Contraseña actualizada correctamente' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { message: 'Si el correo existe en nuestro sistema, recibirás las instrucciones de recuperación.' };
    }

    const token = randomUUID();
    const expires = Date.now() + 15 * 60 * 1000;
    this.recoveryTokens.set(token, { userId: user.id, expires });

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const resetLink = `${appUrl}/reset-password?token=${token}`;
    console.log('\n==================================================');
    console.log(`📧 SIMULACIÓN DE CORREO DE RECUPERACIÓN DE CONTRASEÑA`);
    console.log(`Para: ${email}`);
    console.log(`Enlace de recuperación: ${resetLink}`);
    console.log('==================================================\n');

    return {
      message: 'Si el correo existe en nuestro sistema, recibirás las instrucciones de recuperación.',
    };
  }

  async resetPassword(token: string, newPassword: string) {
    const session = this.recoveryTokens.get(token);
    if (!session || Date.now() > session.expires) {
      throw new UnauthorizedException('Token de recuperación inválido o expirado');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: session.userId },
      data: { passwordHash },
    });

    this.recoveryTokens.delete(token);

    return { message: 'Tu contraseña ha sido reestablecida correctamente' };
  }

  // ── 2FA ─────────────────────────────────────────────────

  async enable2fa(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    if (user.twoFactorSecret) {
      throw new BadRequestException('2FA ya está activado. Desactívalo primero para regenerar el secreto.');
    }

    const secret = speakeasy.generateSecret({
      name: `KIMY:${user.email}`,
      issuer: 'KIMY - Análisis de Tesis',
    });

    // Guardar secreto temporalmente (10 min) para confirm-enable
    this.temp2faSecrets.set(userId, {
      secret: secret.base32,
      email: user.email,
      expires: Date.now() + 600_000,
    });

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCode,
      otpauthUrl: secret.otpauth_url,
    };
  }

  async verify2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    // Si ya tiene un secreto, verificar contra ese; si no, es primera verificación
    const secret = user.twoFactorSecret;
    if (!secret) {
      // Primera activación: el secreto se pasó en el paso anterior (enable)
      throw new BadRequestException('Debes llamar a /auth/2fa/enable primero para obtener el secreto.');
    }

    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      // Intentar con códigos de respaldo
      if (user.twoFactorBackupCodes) {
        const backupCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
        for (let i = 0; i < backupCodes.length; i++) {
          const match = await bcrypt.compare(code, backupCodes[i]);
          if (match) {
            backupCodes.splice(i, 1);
            await this.prisma.user.update({
              where: { id: userId },
              data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
            });
            return { verified: true, usedBackupCode: true, remainingBackupCodes: backupCodes.length };
          }
        }
      }
      throw new BadRequestException('Código 2FA inválido');
    }

    return { verified: true };
  }

  async confirmEnable2fa(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const tempEntry = this.temp2faSecrets.get(userId);
    if (!tempEntry || tempEntry.expires < Date.now()) {
      this.temp2faSecrets.delete(userId);
      throw new BadRequestException('El tiempo para confirmar 2FA expiró. Regresa al paso anterior y escanea el código QR de nuevo.');
    }

    const verified = speakeasy.totp.verify({
      secret: tempEntry.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      throw new BadRequestException('Código 2FA inválido. Intenta de nuevo.');
    }

    this.temp2faSecrets.delete(userId);

    // Generar 8 códigos de respaldo
    const backupCodes: string[] = [];
    const rawCodes: string[] = [];
    for (let i = 0; i < 8; i++) {
      const c = randomUUID().slice(0, 10).toUpperCase();
      const hash = await bcrypt.hash(c, 10);
      backupCodes.push(hash);
      rawCodes.push(c);
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret: tempEntry.secret,
      label: `KIMY:${user.email}`,
      issuer: 'KIMY - Análisis de Tesis',
      encoding: 'base32',
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: tempEntry.secret,
        twoFactorBackupCodes: JSON.stringify(backupCodes),
      },
    });

    return {
      message: '2FA activado correctamente',
      backupCodes: rawCodes, // Se muestran una sola vez
      qrCode: await QRCode.toDataURL(otpauthUrl),
    };
  }

  async disable2fa(userId: string, currentPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Usuario no encontrado');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Contraseña actual incorrecta');

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: null,
        twoFactorBackupCodes: null,
      },
    });

    return { message: '2FA desactivado correctamente' };
  }

  async authenticate2fa(tempToken: string, code: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(tempToken);
    } catch {
      throw new UnauthorizedException('Token temporal inválido o expirado');
    }

    if (payload.type !== '2fa_temp') {
      throw new UnauthorizedException('Token temporal inválido');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { program: { select: { name: true } } },
    });
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedException('2FA no está configurado para este usuario');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: code,
      window: 1,
    });

    if (!verified) {
      // Intentar con códigos de respaldo
      if (user.twoFactorBackupCodes) {
        const backupCodes: string[] = JSON.parse(user.twoFactorBackupCodes);
        for (let i = 0; i < backupCodes.length; i++) {
          const match = await bcrypt.compare(code, backupCodes[i]);
          if (match) {
            backupCodes.splice(i, 1);
            await this.prisma.user.update({
              where: { id: user.id },
              data: { twoFactorBackupCodes: JSON.stringify(backupCodes) },
            });

            const jwtPayload = {
              sub: user.id,
              email: user.email,
              role: user.role,
              programId: user.programId,
            };

            return {
              accessToken: this.jwtService.sign(jwtPayload),
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                programId: user.programId,
                programName: user.program?.name,
                avatarUrl: user.avatarUrl,
              },
              usedBackupCode: true,
              remainingBackupCodes: backupCodes.length,
            };
          }
        }
      }
      throw new UnauthorizedException('Código 2FA inválido');
    }

    const jwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      programId: user.programId,
    };

    return {
      accessToken: this.jwtService.sign(jwtPayload),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        programId: user.programId,
        programName: user.program?.name,
        avatarUrl: user.avatarUrl,
      },
    };
  }
}
