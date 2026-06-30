import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Membuat modul ini tersedia di seluruh aplikasi secara otomatis
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Wajib diekspor agar bisa di-inject ke service lain
})
export class PrismaModule {}
