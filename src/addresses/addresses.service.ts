/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async createAddress(userId: string, data: any) {
    return this.prisma.address.create({
      data: { ...data, userId },
    });
  }

  async getMyAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId } });
  }

  async deleteAddress(userId: string, addressId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) throw new NotFoundException('Alamat tidak ditemukan');

    return this.prisma.address.delete({ where: { id: addressId } });
  }
}
