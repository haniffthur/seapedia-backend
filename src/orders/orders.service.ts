import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryMethod, OrderStatus, Role } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper internal untuk menentukan tarif pengiriman berdasarkan metode
   */
  private getDeliveryFee(method: DeliveryMethod): number {
    switch (method) {
      case DeliveryMethod.INSTANT:
        return 25000;
      case DeliveryMethod.NEXT_DAY:
        return 15000;
      case DeliveryMethod.REGULAR:
        return 10000;
      default:
        return 10000;
    }
  }

  /**
   * LEVEL 3: Core Checkout & Order Processing (ACID Transaction)
   */
  async checkout(
    buyerId: string,
    deliveryMethod: DeliveryMethod,
    addressId: string,
    voucherCode?: string,
  ) {
    // 1. Validasi Alamat Pengiriman
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId: buyerId },
    });
    if (!address) {
      throw new NotFoundException(
        'Alamat pengiriman tidak ditemukan atau bukan milik Anda',
      );
    }

    // 2. Ambil Keranjang Belanja Buyer beserta Relasi Produk
    const cart = await this.prisma.cart.findUnique({
      where: { buyerId },
      include: {
        items: { include: { product: { include: { store: true } } } },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Keranjang belanja Anda kosong');
    }

    // Aturan Single-Store Checkout: Ambil Store ID dari item pertama
    const storeId = cart.items[0].product.storeId;

    // 3. Ambil Dompet Buyer
    let buyerWallet = await this.prisma.wallet.findUnique({
      where: { userId: buyerId },
    });
    if (!buyerWallet) {
      buyerWallet = await this.prisma.wallet.create({
        data: { userId: buyerId, balance: 0 },
      });
    }

    // 4. Kalkulasi Finansial & Validasi Stok Produk
    let subtotal = 0;
    for (const item of cart.items) {
      if (item.product.storeId !== storeId) {
        throw new BadRequestException(
          'Single-Store Checkout Violation: Semua item harus berasal dari toko yang sama',
        );
      }
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Stok produk [${item.product.name}] tidak mencukupi`,
        );
      }
      subtotal += Number(item.product.price) * item.quantity;
    }

    const deliveryFee = this.getDeliveryFee(deliveryMethod);
    const taxPpn = subtotal * 0.12; // Aturan PPN 12% sesuai kebijakan

    // Integrasi Level 4: Validasi & Perhitungan Diskon Voucher
    let discount = 0;
    if (voucherCode) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { code: voucherCode.toUpperCase() },
      });

      if (!voucher || !voucher.isActive) {
        throw new BadRequestException(
          'Kode voucher tidak valid atau sudah kedaluwarsa',
        );
      }

      discount = subtotal * (Number(voucher.discountPercent) / 100);
      if (discount > Number(voucher.maxDiscount)) {
        discount = Number(voucher.maxDiscount);
      }
    }

    const total = subtotal + deliveryFee + taxPpn - discount;

    // Proteksi Saldo
    if (Number(buyerWallet.balance) < total) {
      throw new BadRequestException(
        'Saldo SEAPEDIA Pay Anda tidak mencukupi untuk melakukan transaksi ini',
      );
    }

    // 5. EKSEKUSI DATA SECARA ATOMIK (TRANSACTION)
    return this.prisma.$transaction(async (tx) => {
      // A. Potong Saldo Dompet Buyer & Catat Mutasi
      await tx.wallet.update({
        where: { id: buyerWallet.id },
        data: { balance: { decrement: total } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: buyerWallet.id,
          amount: total,
          type: 'PAYMENT',
          description: `Pembayaran pesanan di marketplace SEAPEDIA`,
        },
      });

      // B. Buat Entitas Induk Order
      const order = await tx.order.create({
        data: {
          buyerId,
          storeId,
          status: OrderStatus.SEDANG_DIKEMAS,
          deliveryMethod,
          subtotal,
          deliveryFee,
          taxPpn,
          discount,
          total,
        },
      });

      // C. Buat Order Items & Kurangi Stok Produk Terjual
      for (const item of cart.items) {
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.product.price,
          },
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // D. Catat Log Histori Status Awal
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.SEDANG_DIKEMAS,
        },
      });

      // E. Kosongkan Keranjang Belanja Buyer
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  /**
   * Mengambil riwayat pesanan yang dibeli oleh Buyer
   */
  async getBuyerOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        store: { select: { name: true } },
        items: { include: { product: true } },
        history: { orderBy: { timestamp: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * LEVEL 4: Otoritas Seller - Mengubah status pesanan siap diambil Kurir
   */
  async setReadyForPickup(sellerOwnerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { ownerId: sellerOwnerId } },
    });

    if (!order) {
      throw new NotFoundException(
        'Pesanan tidak ditemukan atau tidak terdaftar di toko Anda',
      );
    }

    if (order.status !== OrderStatus.SEDANG_DIKEMAS) {
      throw new BadRequestException(
        'Pesanan tidak dapat diproses karena status tidak sesuai',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.MENUNGGU_PENGIRIM },
      });

      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.MENUNGGU_PENGIRIM },
      });

      return updatedOrder;
    });
  }

  /**
   * LEVEL 4: Otoritas Driver - Melihat daftar pesanan nganggur di sekitar
   */
  async getAvailableDeliveries() {
    return this.prisma.order.findMany({
      where: { status: OrderStatus.MENUNGGU_PENGIRIM },
      include: {
        store: { select: { name: true } },
        buyer: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * LEVEL 4: Otoritas Driver - Mengambil & Mengunci Pesanan (Pickup)
   */
  async takeDelivery(driverId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (
      order.status !== OrderStatus.MENUNGGU_PENGIRIM ||
      order.driverId !== null
    ) {
      throw new BadRequestException(
        'Pesanan sudah diambil oleh kurir lain atau status tidak valid',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.SEDANG_DIKIRIM,
          driverId: driverId,
        },
      });

      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.SEDANG_DIKIRIM },
      });

      return updatedOrder;
    });
  }

  /**
   * LEVEL 5: Core Financial Settlement - Menyelesaikan Pengiriman & Pencairan Dana
   */
  async completeDelivery(driverId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId: driverId },
      include: { store: true },
    });

    if (!order) {
      throw new NotFoundException(
        'Pesanan tidak ditemukan atau tugas ini bukan milik Anda',
      );
    }

    if (order.status !== OrderStatus.SEDANG_DIKIRIM) {
      throw new BadRequestException(
        'Pesanan tidak dapat diselesaikan karena belum dikirim',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Update Status Pengiriman Utama
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PESANAN_SELESAI },
      });

      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.PESANAN_SELESAI },
      });

      // 2. FINANCIAL SETTLEMENT: Alokasikan pendapatan (Subtotal) ke Dompet Seller
      let sellerWallet = await tx.wallet.findUnique({
        where: { userId: order.store.ownerId },
      });
      if (!sellerWallet) {
        sellerWallet = await tx.wallet.create({
          data: { userId: order.store.ownerId, balance: 0 },
        });
      }

      await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: { balance: { increment: order.subtotal } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: sellerWallet.id,
          amount: order.subtotal,
          type: 'INCOME',
          description: `Pendapatan penjualan dari transaksi pesanan #${order.id.split('-')[0]}`,
        },
      });

      return updatedOrder;
    });
  }

  /**
   * LEVEL 5: System Resilience - Automated Cron Job Penalti & Refund Otomatis
   * Berjalan otomatis setiap menit untuk memeriksa SLA pengemasan Seller
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleOverdueOrders() {
    this.logger.debug(
      'Otomasi Terjadwal: Memeriksa pelanggaran batas SLA pengemasan...',
    );

    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - 24); // Batas penalti SLA: 24 Jam

    // Ambil semua pesanan yang digantung Seller melebihi threshold
    const overdueOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SEDANG_DIKEMAS,
        createdAt: { lt: thresholdTime },
      },
    });

    for (const order of overdueOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          // A. Gagalkan Pesanan secara Sistem
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.DIKEMBALIKAN },
          });

          await tx.orderStatusHistory.create({
            data: { orderId: order.id, status: OrderStatus.DIKEMBALIKAN },
          });

          // B. AUTOMATED REFUND: Kembalikan Dana Total utuh ke Pembeli
          const buyerWallet = await tx.wallet.findUnique({
            where: { userId: order.buyerId },
          });
          if (buyerWallet) {
            await tx.wallet.update({
              where: { id: buyerWallet.id },
              data: { balance: { increment: order.total } },
            });

            await tx.walletTransaction.create({
              data: {
                walletId: buyerWallet.id,
                amount: order.total,
                type: 'REFUND',
                description: `Refund otomatis: Penjual melanggar SLA pengemasan 24 jam (#${order.id.split('-')[0]})`,
              },
            });
          }

          // C. RESTORE STOCK: Kembalikan kuota stok produk yang tertahan
          const items = await tx.orderItem.findMany({
            where: { orderId: order.id },
          });
          for (const item of items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }
        });

        this.logger.log(
          `[AUTO-FAIL-SAFE] Pesanan #${order.id.split('-')[0]} dibatalkan otomatis dan dana direfund.`,
        );
      } catch (err) {
        this.logger.error(
          `Gagal memproses auto-refund pesanan ${order.id}`,
          err,
        );
      }
    }
  }
}
