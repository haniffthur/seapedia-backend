import { Module } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // Injeksi PrismaModule ke dalam ReviewsModule
  controllers: [ReviewsController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
