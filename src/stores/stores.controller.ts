import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { StoresService } from './stores.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('stores')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
export class StoresController {
  constructor(private readonly storesService: StoresService) {}

  @Post()
  @RequireRoles(Role.SELLER)
  async create(@Body('name') name: string, @GetUser() user: any) {
    return this.storesService.createStore(user.userId, name);
  }

  @Get('me')
  @RequireRoles(Role.SELLER)
  async getMyStore(@GetUser() user: any) {
    return this.storesService.getMyStore(user.userId);
  }
}
