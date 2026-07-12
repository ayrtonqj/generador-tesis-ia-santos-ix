import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ example: 'juan.perez@unitru.edu.pe' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Kimy2026!' })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Juan Pérez García' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ enum: ['STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN'], default: 'STUDENT' })
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
}
