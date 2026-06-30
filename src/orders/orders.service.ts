import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryMethod, OrderStatus } from '@prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // Dummy Tarif Pengiriman (Bisa disesuaikan nanti)
  private getDeliveryFee(method: DeliveryMethod): number {
    switch (method) {
      case 'INSTANT':
        return 25000;
      case 'NEXT_DAY':
        return 15000;
      case 'REGULAR':
        return 10000;
      default:
        return 10000;
    }
  }

  async checkout(
    buyerId: string,
    deliveryMethod: DeliveryMethod,
    addressId: string,
  ) {
    // 1. Ambil Keranjang Belanja Buyer
    const cart = await this.prisma.cart.findUnique({
      where: { buyerId },
      include: { items: { include: { product: true } } },
    });

    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Keranjang belanja Anda kosong');
    }

    const storeId = cart.items[0].product.storeId; // Karena Single-Store Checkout, semua item dari toko yang sama [cite: 76, 241]

    // 2. Ambil Dompet Buyer
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId: buyerId },
    });
    if (!wallet) throw new BadRequestException('Dompet belum diinisialisasi');

    // 3. Kalkulasi Finansial [cite: 56, 253]
    let subtotal = 0;
    for (const item of cart.items) {
      subtotal += Number(item.product.price) * item.quantity;
      if (item.product.stock < item.quantity) {
        throw new BadRequestException(
          `Stok produk ${item.product.name} tidak mencukupi`,
        );
      }
    }

    const deliveryFee = this.getDeliveryFee(deliveryMethod);
    const taxPpn = subtotal * 0.12; // PPN 12%
    const discount = 0; // Akan diimplementasikan di Level 4
    const total = subtotal + deliveryFee + taxPpn - discount;

    if (Number(wallet.balance) < total) {
      throw new BadRequestException(
        'Saldo dompet tidak mencukupi untuk melakukan checkout',
      );
    }

    // 4. EKSEKUSI DATABASE TRANSACTION (ACID)
    return this.prisma.$transaction(async (tx) => {
      // A. Buat Order
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

      // B. Buat Order Items & Kurangi Stok [cite: 256, 266]
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

      // C. Buat History Status Pesanan [cite: 59, 259]
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          status: OrderStatus.SEDANG_DIKEMAS,
        },
      });

      // D. Potong Saldo Wallet & Catat Transaksi
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: total } },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          amount: total,
          type: 'PAYMENT',
          description: `Pembayaran pesanan ${order.id}`,
        },
      });

      // E. Kosongkan Keranjang
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return order;
    });
  }

  // Mengambil Riwayat Pesanan Buyer [cite: 257]
  async getBuyerOrders(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: {
        store: { select: { name: true } },
        items: { include: { product: { select: { name: true } } } },
        history: { orderBy: { timestamp: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
