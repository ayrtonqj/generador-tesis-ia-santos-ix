import { IsString, IsOptional, IsIn, IsNotEmpty } from 'class-validator';

export class UploadDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['es', 'en', 'pt', 'fr', 'de', 'it'])
  targetLang!: string;

  @IsString()
  @IsOptional()
  @IsIn(['es', 'en', 'pt', 'fr', 'de', 'it'])
  sourceLang?: string;

  @IsString()
  @IsOptional()
  @IsIn(['es', 'en', 'pt', 'fr', 'de', 'it'])
  correctedSourceLang?: string;
}
