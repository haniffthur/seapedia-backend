import {
  BadRequestException, // <-- Ini yang sebelumnya terlewat
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  // 1. Constructor wajib di urutan paling atas dalam class
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // 2. Fungsi Register
  async register(dto: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (userExists) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const hashedPassword = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        roles: [Role.BUYER, Role.SELLER, Role.DRIVER],
      },
    });

    return {
      message: 'Registrasi berhasil',
      userId: user.id,
      roles: user.roles,
    };
  }

  // 3. Fungsi Login
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException('Kredensial tidak valid');
    }

    return {
      message: 'Login berhasil, silakan pilih active role',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        availableRoles: user.roles,
      },
    };
  }

  // 4. Fungsi Select Role yang sudah dirapikan
  async selectRole(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User tidak ditemukan');
    }

    if (!user.roles.includes(role as Role)) {
      throw new UnauthorizedException('Role tidak tersedia untuk user ini');
    }

    // PERBAIKAN PAYLOAD: Kita masukkan semua kunci agar kompatibel dengan sistem
    const payload = {
      sub: user.id, // Wajib untuk JwtStrategy bawaan Passport
      userId: user.id, // Wajib untuk Controller kita (@GetUser().userId)
      email: user.email,
      role: role,
      activeRole: role, // Wajib untuk ActiveRoleGuard
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }
}
