import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    // PERBAIKAN DI SINI: Langsung kirim 'body' secara utuh, bukan dipecah 2
    return this.authService.login(body);
  }
  @Post('switch-role')
  @UseGuards(AuthGuard('jwt'))
  async switchRole(@Body('role') role: string, @GetUser() user: any) {
    const result = await this.authService.selectRole(user.userId, role);
    let redirectPath = '/seapedia'; // Default Buyer
    if (role === 'SELLER') redirectPath = '/dashboard/seller';
    if (role === 'DRIVER') redirectPath = '/dashboard/driver';

    return { ...result, redirectPath };
  }

  @Post('select-role')
  async selectRole(
    @Body('userId') userId: string,
    @Body('activeRole') activeRole: string,
  ) {
    if (!userId || !activeRole)
      throw new BadRequestException('User ID dan Active Role wajib diisi');

    // Panggil service untuk generate token
    const result = await this.authService.selectRole(userId, activeRole);

    // Tentukan rute cerdas berdasarkan role (Routing Logic)
    let redirectPath = '/dashboard';
    if (activeRole === 'SELLER') redirectPath = '/dashboard/';
    if (activeRole === 'BUYER') redirectPath = '/dashboard/';

    return {
      accessToken: result.accessToken,
      redirectPath: redirectPath, // Kirim rute ke frontend
    };
  }
}
