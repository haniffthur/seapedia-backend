import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role, DeliveryMethod } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

class CheckoutDto {
  @IsEnum(DeliveryMethod)
  deliveryMethod!: DeliveryMethod;

  @IsString()
  @IsNotEmpty()
  addressId!: string;

  @IsOptional()
  @IsString()
  voucherCode?: string;
}

@Controller('orders')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @RequireRoles(Role.BUYER)
  async executeCheckout(@Body() dto: CheckoutDto, @GetUser() user: any) {
    return this.ordersService.checkout(
      user.userId,
      dto.deliveryMethod,
      dto.addressId,
      dto.voucherCode,
    );
  }

  @Get('me')
  @RequireRoles(Role.BUYER)
  async getMyShoppingHistory(@GetUser() user: any) {
    return this.ordersService.getBuyerOrders(user.userId);
  }

  @Put(':id/ready')
  @RequireRoles(Role.SELLER)
  async markOrderAsReady(@Param('id') orderId: string, @GetUser() user: any) {
    return this.ordersService.setReadyForPickup(user.userId, orderId);
  }

  @Get('deliveries/available')
  @RequireRoles(Role.DRIVER)
  async listAvailableJobs(@GetUser() user: any) {
    // PERBAIKAN: Mengirimkan userId kurir ke service untuk Anti-Fraud
    return this.ordersService.getAvailableDeliveries(user.userId);
  }

  @Put(':id/take')
  @RequireRoles(Role.DRIVER)
  async acceptJobAssignment(
    @Param('id') orderId: string,
    @GetUser() user: any,
  ) {
    return this.ordersService.takeDelivery(user.userId, orderId);
  }

  @Put(':id/complete')
  @RequireRoles(Role.DRIVER)
  async completeJobAssignment(
    @Param('id') orderId: string,
    @GetUser() user: any,
  ) {
    return this.ordersService.completeDelivery(user.userId, orderId);
  }
}
