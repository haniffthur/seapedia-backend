import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==================== PUBLIC ENDPOINTS ====================

  @Get()
  async getProducts() {
    return this.productsService.getAllPublicProducts();
  }

  @Get('categories')
  async getAllCategories() {
    return this.productsService.getCategories();
  }

  // ==================== SELLER ENDPOINTS ====================

  @Post()
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.SELLER)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/products',
        filename: (req, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `product-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/\/(jpg|jpeg|png|webp)$/)) {
          return cb(
            new BadRequestException(
              'Hanya file gambar (JPG, PNG, WEBP) yang diizinkan!',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async createProduct(
    @Body() body: any,
    @GetUser() user: any,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    // PERBAIKAN TYPE SCRIPT: Definisikan tipe secara eksplisit
    let imageUrl: string | undefined = undefined;

    if (file) {
      imageUrl = `http://localhost:3001/uploads/products/${file.filename}`;
    }

    return this.productsService.createProduct(user.userId, body, imageUrl);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.SELLER)
  async deleteProduct(@Param('id') productId: string, @GetUser() user: any) {
    return this.productsService.deleteProduct(user.userId, productId);
  }
}
