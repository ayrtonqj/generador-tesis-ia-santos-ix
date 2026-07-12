import { IsOptional, IsString, IsIn, IsNumberString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryUsersDto {
  @ApiPropertyOptional({ enum: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] })
  @IsOptional()
  @IsString()
  @IsIn(['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'])
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiPropertyOptional({ description: 'Buscar por nombre o email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: '1' })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({ default: '50' })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({ default: 'false' })
  @IsOptional()
  @IsString()
  includeInactive?: string;
}
