import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { StoresModule } from '../stores/stores.module';

@Module({
  imports: [StoresModule], // Wajib ditambahkan untuk memanggil StoresService
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
