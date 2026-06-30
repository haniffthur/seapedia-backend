import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
// Import yang sebelumnya hilang sudah ditambahkan di bawah ini:
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  // Melindungi rute ini jika user ingin melakukan switch role saat sudah login
  @Post('select-role')
  async selectRole(
    @Body('userId') userId: string,
    @Body('activeRole') activeRole: string,
  ) {
    if (!userId || !activeRole) {
      throw new BadRequestException('User ID dan Active Role wajib diisi');
    }

    const result = await this.authService.selectRole(userId, activeRole);

    let redirectPath = '/seapedia'; // Default untuk BUYER
    if (activeRole === 'SELLER') redirectPath = '/dashboard/seller';
    if (activeRole === 'DRIVER') redirectPath = '/dashboard/driver';

    return {
      accessToken: result.accessToken,
      redirectPath: redirectPath,
    };
  }
}
