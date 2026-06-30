import {
  BadRequestException,
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

  async selectRole(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User tidak ditemukan');
    }

    if (!user.roles.includes(role as Role)) {
      throw new UnauthorizedException('Role tidak tersedia untuk user ini');
    }

    // PAYLOAD LENGKAP: Mendukung fungsionalitas Switch Role di Frontend
    const payload = {
      sub: user.id,
      userId: user.id,
      email: user.email,
      role: role,
      activeRole: role,
      availableRoles: user.roles,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return { accessToken };
  }
}
