import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('programs')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard)
export class ProgramsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.program.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }
}
