import {
  Controller, Get, Post, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewService } from './review.service';

@ApiTags('reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewController {
  constructor(private reviewService: ReviewService) {}

  @Post(':advanceId')
  @Roles('ADVISOR', 'COORDINATOR')
  createOrUpdate(
    @Param('advanceId') advanceId: string,
    @Request() req: any,
    @Body() body: {
      finalGrade?: number;
      humanComment?: string;
      rubricAnswers?: any;
      status: string;
    },
  ) {
    return this.reviewService.createOrUpdate({
      advanceId,
      reviewerId: req.user.sub,
      ...body,
    });
  }

  @Get(':advanceId')
  getReview(@Param('advanceId') advanceId: string) {
    return this.reviewService.getReview(advanceId);
  }

  @Post('findings/:findingId/feedback')
  @Roles('ADVISOR', 'COORDINATOR')
  submitFeedback(
    @Param('findingId') findingId: string,
    @Request() req: any,
    @Body() body: {
      action: string;
      humanComment?: string;
      adjustedSeverity?: string;
      adjustedDescription?: string;
    },
  ) {
    return this.reviewService.submitFindingFeedback({
      findingId,
      reviewerId: req.user.sub,
      ...body,
    });
  }
}
