import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  // Mengambil dompet, jika belum ada, buatkan otomatis dengan saldo 0
  async getMyWallet(userId: string) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' } } },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId, balance: 0 },
        include: { transactions: true },
      });
    }
    return wallet;
  }

  // Fitur Top Up Dummy
  async dummyTopUp(userId: string, amount: number) {
    // Pastikan dompet sudah ada
    const wallet = await this.getMyWallet(userId);

    // Gunakan Prisma Transaction agar update saldo dan riwayat tercatat bersamaan (ACID)
    return this.prisma.$transaction(async (prisma) => {
      const updatedWallet = await prisma.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: amount } },
      });

      await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: amount,
          type: 'TOP_UP',
          description: 'Dummy Top-Up dari sistem',
        },
      });

      return updatedWallet;
    });
  }
}
