import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { WalletsModule } from './wallets/wallets.module';
import { AddressesModule } from './addresses/addresses.module';
import { CartsModule } from './carts/carts.module';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    ReviewsModule,
    StoresModule,
    ProductsModule,
    WalletsModule,
    AddressesModule,
    CartsModule,
    OrdersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
