import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartsService {
  constructor(private prisma: PrismaService) {}

  // 1. Ambil Keranjang (Lazy Initialization)
  async getCart(buyerId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { buyerId },
      include: {
        items: {
          include: { product: { include: { store: true } } },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { buyerId },
        include: {
          items: { include: { product: { include: { store: true } } } },
        },
      });
    }
    return cart;
  }

  // 2. Tambah Produk ke Keranjang (Dengan Validasi Single-Store)
  async addToCart(buyerId: string, productId: string, quantity: number) {
    const cart = await this.getCart(buyerId);

    // Cek produk yang mau ditambahkan
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new NotFoundException('Produk tidak ditemukan');
    if (product.stock < quantity)
      throw new ConflictException('Stok produk tidak mencukupi');

    // VALIDASI PRD LEVEL 3: SINGLE-STORE CHECKOUT RULE
    if (cart.items.length > 0) {
      const existingStoreId = cart.items[0].product.storeId;
      if (existingStoreId !== product.storeId) {
        throw new ConflictException(
          'Keranjang hanya boleh berisi produk dari satu toko. Silakan kosongkan keranjang Anda terlebih dahulu.',
        );
      }
    }

    // Cek apakah produk sudah ada di keranjang, jika ya, tambahkan quantity-nya
    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      return this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      return this.prisma.cartItem.create({
        data: { cartId: cart.id, productId, quantity },
      });
    }
  }

  // 3. Update Quantity (untuk UI Keranjang)
  async updateQuantity(cartItemId: string, quantity: number) {
    if (quantity <= 0) return this.removeFromCart(cartItemId);

    return this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });
  }

  // 4. Hapus Item dari Keranjang
  async removeFromCart(cartItemId: string) {
    return this.prisma.cartItem.delete({ where: { id: cartItemId } });
  }

  // 5. Kosongkan Keranjang (Berguna jika Buyer ingin pindah toko)
  async clearCart(buyerId: string) {
    const cart = await this.getCart(buyerId);
    return this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  }
}
