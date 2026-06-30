/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // PUBLIC ENDPOINT: Siapapun (Guest) bisa melihat katalog produk
  @Get()
  async getPublicCatalog() {
    return this.productsService.getAllPublicProducts();
  }

  // PROTECTED ENDPOINT: Hanya SELLER yang bisa tambah produk
  @Post()
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.SELLER)
  async createProduct(@Body() data: any, @GetUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.productsService.createProduct(user.userId, data);
  }

  // PROTECTED ENDPOINT: Hanya SELLER pemilik yang bisa hapus
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.SELLER)
  async deleteProduct(@Param('id') productId: string, @GetUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return this.productsService.deleteProduct(user.userId, productId);
  }
}
