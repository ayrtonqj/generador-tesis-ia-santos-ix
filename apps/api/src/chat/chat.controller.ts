import {
  Controller, Get, Post, Delete, Patch,
  Body, Param, Req, Res, UseGuards,
  Logger, UseInterceptors, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { TextToSpeechDto } from './dto/text-to-speech.dto';

@ApiTags('chat')
@ApiBearerAuth()
@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private chatService: ChatService) {}

  @Post('send')
  async sendMessage(
    @Body() dto: SendMessageDto,
    @Req() req: any,
    @Res() res: Response,
  ) {
    this.logger.log(`[CONTROLLER] POST /chat/send — userId="${req.user.sub}", conversationId="${dto.conversationId || 'nueva'}", messageLength=${dto.message?.length}`);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
      const generator = this.chatService.streamChat(
        req.user.sub,
        dto.conversationId,
        dto.message,
      );

      for await (const chunk of generator) {
        res.write(`data: ${chunk}\n\n`);
      }

      res.write('data: {"type":"stream_end"}\n\n');
    } catch (err: any) {
      this.logger.error(`Error en SSE stream: ${err.message}`);
      res.write(`data: ${JSON.stringify({ type: 'error', content: err.message || 'Error interno del servidor' })}\n\n`);
    } finally {
      res.end();
    }
  }

  @Post('speech-to-text')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async speechToText(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No se recibió archivo de audio');
    this.logger.log(`[CONTROLLER] POST /chat/speech-to-text — filename="${file.originalname}", size=${file.size}, mime="${file.mimetype}"`);
    const transcript = await this.chatService.transcribeAudio(file.buffer, file.mimetype || 'audio/webm');
    return { transcript };
  }

  @Post('text-to-speech')
  async textToSpeech(
    @Body() dto: TextToSpeechDto,
    @Res() res: Response,
  ) {
    const audioBuffer = await this.chatService.generateSpeech(dto.text);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', audioBuffer.length.toString());
    res.send(audioBuffer);
  }

  @Get('conversations')
  getConversations(@Req() req: any) {
    return this.chatService.getConversations(req.user.sub);
  }

  @Get('conversations/:id/messages')
  getMessages(@Param('id') id: string, @Req() req: any) {
    return this.chatService.getMessages(id, req.user.sub);
  }

  @Delete('conversations/:id')
  deleteConversation(@Param('id') id: string, @Req() req: any) {
    return this.chatService.deleteConversation(id, req.user.sub);
  }

  @Patch('conversations/:id')
  renameConversation(
    @Param('id') id: string,
    @Body('title') title: string,
    @Req() req: any,
  ) {
    return this.chatService.renameConversation(id, title, req.user.sub);
  }
}
