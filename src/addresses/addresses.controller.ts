import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('addresses')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
@RequireRoles(Role.BUYER) // Proteksi khusus Buyer
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Post()
  async create(@Body() data: any, @GetUser() user: any) {
    return this.addressesService.createAddress(user.userId, data);
  }

  @Get()
  async findAll(@GetUser() user: any) {
    return this.addressesService.getMyAddresses(user.userId);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @GetUser() user: any) {
    return this.addressesService.deleteAddress(user.userId, id);
  }
}
