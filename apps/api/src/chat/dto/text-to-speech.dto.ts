import { IsString } from 'class-validator';

export class TextToSpeechDto {
  @IsString()
  text!: string;
}
