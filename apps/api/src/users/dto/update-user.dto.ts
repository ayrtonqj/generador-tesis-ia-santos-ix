import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'] })
  @IsOptional()
  @IsString()
  @IsIn(['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'])
  role?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  programId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  advisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
