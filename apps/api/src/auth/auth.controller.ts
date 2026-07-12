import { Controller, Post, Body, Get, UseGuards, Request, Headers } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IsEmail, IsString, MinLength, IsOptional, IsNumberString } from 'class-validator';

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsString()
  programId?: string;
}

class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

class ForgotPasswordDto {
  @IsEmail()
  email!: string;
}

class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6)
  newPassword!: string;
}

class Enable2faDto {
  // No body needed
}

class Verify2faDto {
  @IsString()
  code!: string;
}

class Disable2faDto {
  @IsString()
  currentPassword!: string;
}

class Authenticate2faDto {
  @IsString()
  tempToken!: string;

  @IsString()
  code!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  login(
    @Body() dto: LoginDto,
    @Request() req: any,
    @Headers('user-agent') userAgent?: string,
  ) {
    const ip = req.ip || req.connection?.remoteAddress;
    return this.authService.login(dto.email, dto.password, ip, userAgent);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getProfile(@Request() req: any) {
    return this.authService.validateUser(req.user.sub);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // ── 2FA Endpoints ─────────────────────────────────────

  @Post('2fa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  enable2fa(@Request() req: any) {
    return this.authService.enable2fa(req.user.sub);
  }

  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  verify2fa(@Request() req: any, @Body() dto: Verify2faDto) {
    return this.authService.verify2fa(req.user.sub, dto.code);
  }

  @Post('2fa/confirm-enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  confirmEnable2fa(@Request() req: any, @Body() dto: Verify2faDto) {
    return this.authService.confirmEnable2fa(req.user.sub, dto.code);
  }

  @Post('2fa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  disable2fa(@Request() req: any, @Body() dto: Disable2faDto) {
    return this.authService.disable2fa(req.user.sub, dto.currentPassword);
  }

  @Post('2fa/authenticate')
  authenticate2fa(@Body() dto: Authenticate2faDto) {
    return this.authService.authenticate2fa(dto.tempToken, dto.code);
  }
}
