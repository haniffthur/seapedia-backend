/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async submitAppReview(reviewerName: string, rating: number, comment: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return this.prisma.applicationReview.create({
      data: {
        reviewerName,
        rating,
        comment, // Proteksi XSS (Level 7) akan kita terapkan di Frontend saat me-render comment ini
      },
    });
  }

  async getAppReviews() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    return this.prisma.applicationReview.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10, // Menampilkan 10 review terbaru
    });
  }
}
