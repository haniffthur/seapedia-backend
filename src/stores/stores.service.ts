/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  async createStore(ownerId: string, name: string) {
    // Validasi: Cek apakah user sudah punya toko
    const existingStore = await this.prisma.store.findUnique({
      where: { ownerId },
    });
    if (existingStore) throw new ForbiddenException('Anda sudah memiliki toko');

    try {
      return await this.prisma.store.create({
        data: { name, ownerId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Nama toko sudah digunakan');
      }
      throw error;
    }
  }

  async getMyStore(ownerId: string) {
    return this.prisma.store.findUnique({
      where: { ownerId },
      include: { products: true },
    });
  }
}
