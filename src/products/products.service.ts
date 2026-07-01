import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== SELLER LOGIC ====================

  async createProduct(ownerId: string, data: any, imagePath?: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) {
      throw new NotFoundException(
        'Anda belum memiliki toko. Silakan buat toko terlebih dahulu.',
      );
    }

    if (data.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: data.categoryId },
      });
      if (!category) throw new BadRequestException('Kategori tidak valid');
    }

    return this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: Number(data.price),
        stock: Number(data.stock),
        categoryId: data.categoryId || null,
        storeId: store.id,
        imageUrl: imagePath || null,
      },
    });
  }

  async deleteProduct(ownerId: string, productId: string) {
    const store = await this.prisma.store.findUnique({ where: { ownerId } });
    if (!store) {
      throw new NotFoundException('Anda belum memiliki toko.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
    });

    if (!product) {
      throw new NotFoundException(
        'Produk tidak ditemukan atau bukan milik toko Anda.',
      );
    }

    return this.prisma.product.delete({
      where: { id: productId },
    });
  }

  // ==================== PUBLIC LOGIC ====================

  async getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getAllPublicProducts() {
    return this.prisma.product.findMany({
      include: {
        // ANTI-FRAUD UPDATE: Sertakan ownerId agar Frontend bisa melakukan validasi
        store: { select: { id: true, name: true, ownerId: true } },
        category: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
