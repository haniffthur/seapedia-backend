import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StoresModule } from './stores/stores.module';
import { ProductsModule } from './products/products.module';
import { WalletsModule } from './wallets/wallets.module';
import { AddressesModule } from './addresses/addresses.module';
import { CartsModule } from './carts/carts.module';
import { OrdersModule } from './orders/orders.module';
import { join } from 'path';
import { VouchersModule } from './vouchers/vouchers.module';
import { ServeStaticModule } from '@nestjs/serve-static';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
      rootPath: join(__dirname, '..', 'uploads'),
      serveRoot: '/uploads/',
    }),
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
    VouchersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
