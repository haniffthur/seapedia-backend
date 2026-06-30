import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from '../common/decorators/get-user.decorator';

@Controller('users')
export class UsersController {
  // Endpoint ini mendemonstrasikan bahwa sistem tahu siapa user-nya dan apa ACTIVE ROLE-nya
  @Get('profile')
  @UseGuards(AuthGuard('jwt')) // Melindungi route ini, wajib bawa token
  getProfile(@GetUser() user: any) {
    return {
      message: 'Profil berhasil diambil berdasarkan sesi aktif',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      user: user, // Akan mengembalikan userId, email, dan activeRole
    };
  }
}
