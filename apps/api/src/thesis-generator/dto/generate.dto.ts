import { IsString, IsOptional, IsArray, ArrayMinSize, MinLength, IsIn } from 'class-validator';

export class GenerateDto {
  @IsString()
  templateId!: string;

  @IsString()
  @MinLength(3)
  topic!: string;

  @IsOptional()
  @IsString()
  userPrompt?: string;

  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  sectionNames!: string[];

  @IsOptional()
  @IsString()
  aiProvider?: string;

  @IsOptional()
  @IsString()
  aiModel?: string;

  @IsOptional()
  @IsString()
  @IsIn(['menos-10', '10-20', '20-30', '30-40', '40-50', '50-60', '60-70', '70-80', '+80'])
  targetPageRange?: 'menos-10' | '10-20' | '20-30' | '30-40' | '40-50' | '50-60' | '60-70' | '70-80' | '+80';
}
