import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/require-roles.decorator';

@Injectable()
export class ActiveRoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Ambil metadata role yang dibutuhkan dari controller
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Jika tidak ada decorator @RequireRoles, endpoint berarti bersifat publik / untuk role apa saja
    if (!requiredRoles) {
      return true;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { user } = context.switchToHttp().getRequest();

    // PRD Level 1: Authorization must follow the ACTIVE ROLE
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!user || !user.activeRole) {
      throw new ForbiddenException(
        'Akses ditolak: Active Role tidak ditemukan',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const hasAccess = requiredRoles.includes(user.activeRole);
    if (!hasAccess) {
      throw new ForbiddenException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        `Akses ditolak untuk role: ${user.activeRole}`,
      );
    }

    return true;
  }
}
