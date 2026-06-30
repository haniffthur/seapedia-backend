/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StoresService } from '../stores/stores.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private storesService: StoresService, // Kita inject StoresService untuk validasi kepemilikan
  ) {}
  async createProduct(ownerId: string, data: any) {
    const store = await this.storesService.getMyStore(ownerId);
    if (!store) throw new ForbiddenException('Anda harus membuat toko terlebih dahulu');

    return this.prisma.product.create({
      data: {
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
        imageUrl: data.imageUrl || null, // Tangkap data URL gambar
        storeId: store.id,
      },
    });
  }

  // Endpoint Publik (Level 2: Public Catalog)
  async getAllPublicProducts() {
    return this.prisma.product.findMany({
      include: { store: { select: { name: true } } }, // Join untuk mendapatkan nama toko
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteProduct(ownerId: string, productId: string) {
    const store = await this.storesService.getMyStore(ownerId);
    if (!store) throw new ForbiddenException('Toko tidak ditemukan');

    // Pastikan produk yang akan dihapus benar-benar milik toko ini
    const product = await this.prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
    });

    if (!product)
      throw new NotFoundException(
        'Produk tidak ditemukan atau bukan milik Anda',
      );

    return this.prisma.product.delete({ where: { id: productId } });
  }
}
