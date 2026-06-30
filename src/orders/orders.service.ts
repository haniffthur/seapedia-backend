import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryMethod, OrderStatus } from '@prisma/client';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getDeliveryFee(method: DeliveryMethod): number {
    if (method === DeliveryMethod.INSTANT) return 25000;
    if (method === DeliveryMethod.NEXT_DAY) return 15000;
    return 10000;
  }

  // ==================== CHECKOUT ====================
  async checkout(
    buyerId: string,
    deliveryMethod: DeliveryMethod,
    addressId: string,
    voucherCode?: string,
  ) {
    const cart = await this.prisma.cart.findUnique({
      where: { buyerId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0)
      throw new BadRequestException('Keranjang kosong');

    const storeId = cart.items[0].product.storeId;
    let wallet = await this.prisma.wallet.findUnique({
      where: { userId: buyerId },
    });

    if (!wallet) {
      wallet = await this.prisma.wallet.create({
        data: { userId: buyerId, balance: 0 },
      });
    }

    let subtotal = 0;
    for (const item of cart.items) {
      if (item.product.storeId !== storeId)
        throw new BadRequestException('Semua item harus dari toko yang sama');
      if (item.product.stock < item.quantity)
        throw new BadRequestException(`Stok ${item.product.name} kurang`);
      subtotal += Number(item.product.price) * item.quantity;
    }

    const deliveryFee = this.getDeliveryFee(deliveryMethod);
    const taxPpn = subtotal * 0.12;

    let discount = 0;
    if (voucherCode) {
      const voucher = await this.prisma.voucher.findUnique({
        where: { code: voucherCode.toUpperCase() },
      });
      if (voucher && voucher.isActive) {
        discount = subtotal * (Number(voucher.discountPercent) / 100);
        if (discount > Number(voucher.maxDiscount))
          discount = Number(voucher.maxDiscount);
      } else {
        throw new BadRequestException('Kode Voucher tidak valid');
      }
    }

    const total = subtotal + deliveryFee + taxPpn - discount;

    if (Number(wallet.balance) < total) {
      throw new BadRequestException('Saldo dompet tidak mencukupi');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: total } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: total,
          type: 'PAYMENT',
          description: `Pembayaran pesanan`,
        },
      });

      const order = await tx.order.create({
        data: {
          buyerId,
          storeId,
          deliveryMethod,
          subtotal,
          deliveryFee,
          taxPpn,
          discount,
          total,
          status: OrderStatus.SEDANG_DIKEMAS,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: i.product.price,
            })),
          },
          history: { create: { status: OrderStatus.SEDANG_DIKEMAS } },
        },
      });

      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
  }

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

  // ==================== LOGISTIK ====================
  async setReadyForPickup(sellerOwnerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { ownerId: sellerOwnerId } },
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (order.status !== OrderStatus.SEDANG_DIKEMAS)
      throw new BadRequestException('Status tidak valid');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.MENUNGGU_PENGIRIM },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.MENUNGGU_PENGIRIM },
      });
      return updated;
    });
  }

  // ANTI-FRAUD: Mengecualikan pesanan yang tokonya dimiliki oleh kurir itu sendiri
  async getAvailableDeliveries(driverId: string) {
    return this.prisma.order.findMany({
      where: {
        status: OrderStatus.MENUNGGU_PENGIRIM,
        store: { ownerId: { not: driverId } },
      },
      include: {
        store: { select: { name: true } },
        buyer: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async takeDelivery(driverId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { store: true },
    });

    if (!order) throw new NotFoundException('Pesanan tidak ditemukan');
    if (
      order.status !== OrderStatus.MENUNGGU_PENGIRIM ||
      order.driverId !== null
    ) {
      throw new BadRequestException('Pesanan tidak valid atau sudah diambil');
    }
    if (order.store.ownerId === driverId) {
      throw new BadRequestException(
        'Anda tidak dapat menjadi kurir untuk pesanan dari toko Anda sendiri',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.SEDANG_DIKIRIM, driverId },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.SEDANG_DIKIRIM },
      });
      return updated;
    });
  }

  // ==================== SETTLEMENT FINANSIAL ====================
  async completeDelivery(driverId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, driverId: driverId },
      include: { store: true },
    });

    if (!order) throw new NotFoundException('Pesanan bukan tugas Anda');
    if (order.status !== OrderStatus.SEDANG_DIKIRIM)
      throw new BadRequestException('Belum dalam pengiriman');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.PESANAN_SELESAI },
      });
      await tx.orderStatusHistory.create({
        data: { orderId, status: OrderStatus.PESANAN_SELESAI },
      });

      let sellerWallet = await tx.wallet.findUnique({
        where: { userId: order.store.ownerId },
      });
      if (!sellerWallet)
        sellerWallet = await tx.wallet.create({
          data: { userId: order.store.ownerId, balance: 0 },
        });

      await tx.wallet.update({
        where: { id: sellerWallet.id },
        data: { balance: { increment: order.subtotal } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: sellerWallet.id,
          amount: order.subtotal,
          type: 'INCOME',
          description: `Pendapatan pesanan ${order.id.split('-')[0]}`,
        },
      });

      return updated;
    });
  }

  // ==================== CRON JOB ====================
  @Cron(CronExpression.EVERY_MINUTE)
  async handleOverdueOrders() {
    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - 24);

    const overdueOrders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.SEDANG_DIKEMAS,
        createdAt: { lt: thresholdTime },
      },
    });

    for (const order of overdueOrders) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.DIKEMBALIKAN },
          });
          await tx.orderStatusHistory.create({
            data: { orderId: order.id, status: OrderStatus.DIKEMBALIKAN },
          });

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
                description: `Refund otomatis SLA 24 jam`,
              },
            });
          }

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
          `Pesanan ${order.id} dibatalkan otomatis dan direfund.`,
        );
      } catch (err) {
        this.logger.error(`Gagal refund otomatis pesanan ${order.id}`, err);
      }
    }
  }
}
