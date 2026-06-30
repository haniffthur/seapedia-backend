import { Module } from '@nestjs/common';
import { StoresService } from './stores.service';
import { StoresController } from './stores.controller';

@Module({
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService], // Wajib ditambahkan agar bisa dibaca modul lain
})
export class StoresModule {}
