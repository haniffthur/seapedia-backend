import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { WalletsService } from './wallets.service';
import { AuthGuard } from '@nestjs/passport';
import { ActiveRoleGuard } from '../common/guards/active-role.guard';
import { RequireRoles } from '../common/decorators/require-roles.decorator';
import { Role } from '@prisma/client';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('wallets')
@UseGuards(AuthGuard('jwt'), ActiveRoleGuard)
@RequireRoles(Role.BUYER) // Sesuai PRD: Hanya Role BUYER
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get('me')
  async getWallet(@GetUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.walletsService.getMyWallet(user.userId);
  }

  @Post('topup')
  async topUp(@Body('amount') amount: number, @GetUser() user: any) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.walletsService.dummyTopUp(user.userId, Number(amount));
  }
}
