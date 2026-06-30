import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class SelectRoleDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsEnum(Role)
  activeRole!: Role;
}
