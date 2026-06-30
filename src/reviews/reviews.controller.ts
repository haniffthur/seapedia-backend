/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Controller, Post, Get, Body } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

// DTO untuk Validasi Input (Best Practice keamanan)
class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  reviewerName!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsNotEmpty()
  comment!: string;
}

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  async createReview(@Body() dto: CreateReviewDto) {
    return this.reviewsService.submitAppReview(
      dto.reviewerName,
      dto.rating,
      dto.comment,
    );
  }

  @Get()
  async getAllReviews() {
    return this.reviewsService.getAppReviews();
  }
}
