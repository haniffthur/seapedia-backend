import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import * as argon2 from 'argon2';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const userExists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (userExists) {
      throw new ConflictException('Email sudah terdaftar');
    }

    const hashedPassword = await argon2.hash(dto.password);

    // Default registrasi diberikan role BUYER dan SELLER untuk mendemonstrasikan multi-role
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        password: hashedPassword,
        roles: [Role.BUYER, Role.SELLER],
      },
    });

    return {
      message: 'Registrasi berhasil',
      userId: user.id,
      roles: user.roles,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !(await argon2.verify(user.password, dto.password))) {
      throw new UnauthorizedException('Kredensial tidak valid');
    }

    // Hanya mengembalikan profil dan daftar role. User BELUM bisa akses private endpoint
    // sampai mereka memanggil endpoint select-role. (Sesuai PRD Level 1)
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

  async selectActiveRole(dto: SelectRoleDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });

    if (!user || !user.roles.includes(dto.activeRole)) {
      throw new UnauthorizedException('Role tidak tersedia untuk user ini');
    }

    // Generate JWT yang mengandung "activeRole"
    const payload = {
      sub: user.id,
      email: user.email,
      activeRole: dto.activeRole,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      activeRole: dto.activeRole,
    };
  }
}
