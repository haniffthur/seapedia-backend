import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role, DeliveryMethod } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

// DTO Validasi Input Checkout
class CheckoutDto {
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsString()
  @IsNotEmpty()
  addressId!: string;
}

@Controller('orders')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @RequireRoles(Role.BUYER)
  async checkout(@Body() dto: CheckoutDto, @GetUser() user: any) {
    return this.ordersService.checkout(
      user.userId,
      dto.deliveryMethod,
      dto.addressId,
    );
  }

  @Get('me')
  @RequireRoles(Role.BUYER)
  async getMyOrders(@GetUser() user: any) {
    return this.ordersService.getBuyerOrders(user.userId);
  }
}
