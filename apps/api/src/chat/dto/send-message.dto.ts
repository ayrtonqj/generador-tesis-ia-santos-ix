import { IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsString()
  message!: string;
}
