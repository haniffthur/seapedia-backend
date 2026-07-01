import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CartsService } from './carts.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('carts')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
@RequireRoles(Role.BUYER)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get()
  async getMyCart(@GetUser() user: any) {
    return this.cartsService.getCart(user.userId);
  }

  @Post('items')
  async addItem(
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
    @GetUser() user: any,
  ) {
    return this.cartsService.addToCart(
      user.userId,
      productId,
      Number(quantity),
    );
  }

  @Put('items/:itemId')
  async updateItem(
    @Param('itemId') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartsService.updateQuantity(itemId, Number(quantity));
  }

  @Delete('items/:itemId')
  async removeItem(@Param('itemId') itemId: string) {
    return this.cartsService.removeFromCart(itemId);
  }

  @Delete()
  async clearMyCart(@GetUser() user: any) {
    return this.cartsService.clearCart(user.userId);
  }
  @Put('items/:id')
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.BUYER)
  async updateCartItem(
    @Param('id') itemId: string,
    @Body('quantity') quantity: number,
  ) {
    return this.cartsService.updateItemQuantity(itemId, quantity);
  }

  @Delete('items/:id')
  @UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
  @RequireRoles(Role.BUYER)
  async removeCartItem(@Param('id') itemId: string) {
    return this.cartsService.removeCartItem(itemId);
  }
}
