import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletsService {
  constructor(private prisma: PrismaService) {}

  // Mengambil dompet, jika belum ada, buatkan otomatis dengan saldo 0
  async getWallet(userId: string) {
    // 1. Coba cari dompet beserta riwayat transaksinya
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 2. AUTO-CREATE LOGIC: Jika belum ada (misal Seller baru), buatkan dompet kosong
    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: {
          userId,
          balance: 0,
        },
        // Kembalikan format yang sama (transactions kosong)
        include: {
          transactions: true,
        },
      });
    }

    return wallet;
  }

  // Fitur Top Up Dummy
  async dummyTopUp(userId: string, amount: number) {
    // Pastikan dompet sudah ada
    const wallet = await this.getWallet(userId);

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
