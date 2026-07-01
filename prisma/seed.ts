import { PrismaClient, Role, DeliveryMethod } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log(
    '🌱 [SEEDER] Memulai reset data dan pengisian data dummy secara menyeluruh...',
  );

  // ------------------------------------------------------------
  // 1. CLEAR EXISTING DATA (Optional Safety Net)
  // Menghapus data dengan urutan terbalik dari relasi untuk menghindari Foreign Key Constraint
  // ------------------------------------------------------------
  await prisma.orderStatusHistory.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.store.deleteMany({});
  await prisma.walletTransaction.deleteMany({});
  await prisma.wallet.deleteMany({});
  await prisma.voucher.deleteMany({});
  await prisma.address.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.category.deleteMany({});

  console.log('🗑️ [SEEDER] Database berhasil dibersihkan.');

  // ------------------------------------------------------------
  // 2. SEED KATEGORI UTAMA
  // ------------------------------------------------------------
  const categoriesData = [
    { name: 'Elektronik', icon: '💻' },
    { name: 'Pakaian & Fashion', icon: '👕' },
    { name: 'Makanan & Minuman', icon: '🍔' },
    { name: 'Olahraga', icon: '⚽' },
    { name: 'Kecantikan', icon: '💄' },
    { name: 'Buku & Alat Tulis', icon: '📚' },
    { name: 'Otomotif', icon: '🚗' },
    { name: 'Perabotan Rumah', icon: '🏡' },
  ];

  const categories: any = {};
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.create({
      data: { name: cat.name, icon: cat.icon },
    });
    // Simpan referensi ID untuk digunakan pada pembuatan produk nanti
    categories[cat.name] = createdCat.id;
  }
  console.log('📋 [SEEDER] Kategori berhasil dibuat.');

  // ------------------------------------------------------------
  // 3. SEED AKUN PENGGUNA (USERS) DENGAN ARGON2 HASH
  // ------------------------------------------------------------
  const defaultPasswordHash = await argon2.hash('password123');

  // Akun Super Uji Coba (Memiliki semua Peran)
  const userHanif = await prisma.user.create({
    data: {
      email: 'hanif@seapedia.com',
      name: 'Hanif Fathurrahman',
      password: defaultPasswordHash,
      roles: [Role.BUYER, Role.SELLER, Role.DRIVER],
    },
  });

  // Akun Buyer Murni
  const userBuyer = await prisma.user.create({
    data: {
      email: 'buyer@seapedia.com',
      name: 'Budi Pembeli',
      password: defaultPasswordHash,
      roles: [Role.BUYER],
    },
  });

  // Akun Seller Murni
  const userSeller = await prisma.user.create({
    data: {
      email: 'seller@seapedia.com',
      name: 'Siti Penjual',
      password: defaultPasswordHash,
      roles: [Role.SELLER],
    },
  });

  // Akun Driver Murni
  const userDriver = await prisma.user.create({
    data: {
      email: 'driver@seapedia.com',
      name: 'Dono Driver',
      password: defaultPasswordHash,
      roles: [Role.DRIVER],
    },
  });

  console.log(
    '👤 [SEEDER] Akun pengguna simulasi (Hanif, Buyer, Seller, Driver) berhasil dibuat.',
  );

  // ------------------------------------------------------------
  // 4. SEED INITIAL WALLET BALANCES (DOMPET DIGITAL)
  // ------------------------------------------------------------
  // Isi saldo awal untuk pembeli agar bisa langsung transaksi tanpa top-up manual
  await prisma.wallet.create({
    data: { userId: userHanif.id, balance: 2500000 },
  });
  await prisma.wallet.create({
    data: { userId: userBuyer.id, balance: 1000000 },
  });
  await prisma.wallet.create({ data: { userId: userSeller.id, balance: 0 } });
  await prisma.wallet.create({
    data: { userId: userDriver.id, balance: 50000 },
  });

  console.log('💳 [SEEDER] Saldo awal SEAPEDIA Pay berhasil dialokasikan.');

  // ------------------------------------------------------------
  // 5. SEED ALAMAT PENGGUNA (ADDRESSES)
  // ------------------------------------------------------------
  const addressHanif = await prisma.address.create({
    data: {
      userId: userHanif.id,
      street: 'Jl. Raya Cipayung No. 12',
      city: 'Jakarta Timur',
      postalCode: '13840',
    },
  });
  await prisma.address.create({
    data: {
      userId: userBuyer.id,
      street: 'Jl. Margonda Raya No. 45',
      city: 'Depok',
      postalCode: '16424',
    },
  });

  console.log('📍 [SEEDER] Alamat pengiriman default berhasil didaftarkan.');

  // ------------------------------------------------------------
  // 6. SEED TOKO SELLER (STORES)
  // ------------------------------------------------------------
  // Toko 1 milik Akun Super Hanif (Bisa kelola produk di sini)
  const storeCemara = await prisma.store.create({
    data: { ownerId: userHanif.id, name: 'Cemara Boys Official' },
  });

  // Toko 2 milik Seller Siti
  const storeSiti = await prisma.store.create({
    data: { ownerId: userSeller.id, name: 'Siti Berkah Elektronik' },
  });

  console.log('🏪 [SEEDER] Entitas Toko Penjual berhasil diverifikasi.');

  // ------------------------------------------------------------
  // 7. SEED KATALOG PRODUK DENGAN IMAGE URL & LINK KATEGORI
  // ------------------------------------------------------------
  const productsData = [
    {
      storeId: storeCemara.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      categoryId: categories['Elektronik'],
      name: 'Wireless Bluetooth Headphone Pro',
      description:
        'Headphone premium dengan fitur Active Noise Cancelling (ANC), suara bass super jernih, dan ketahanan baterai hingga 40 jam penggunaan nonstop.',
      price: 899000,
      stock: 25,
      imageUrl:
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
    },
    {
      storeId: storeCemara.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      categoryId: categories['Pakaian & Fashion'],
      name: 'Minimalist Aesthetic Beanie Hat',
      description:
        'Topi rajut beanie premium dengan bahan wol berkualitas tinggi, sangat lembut, hangat, dan dirancang khusus untuk subkultur gaya jalanan modern.',
      price: 125000,
      stock: 50,
      imageUrl:
        'https://images.unsplash.com/photo-1576871337622-98d48d435350?w=500&q=80',
    },
    {
      storeId: storeSiti.id,
      categoryId: categories['Elektronik'],
      name: 'Ergonomic Mechanical Keyboard RGB',
      description:
        'Keyboard mekanikal layout 75% dengan Gateron Brown Switch, keycaps PBT dual-tone, dan pencahayaan RGB yang dapat dimodifikasi sepenuhnya.',
      price: 650000,
      stock: 12,
      imageUrl:
        'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500&q=80',
    },
    {
      storeId: storeSiti.id,
      categoryId: categories['Perabotan Rumah'],
      name: 'Modern Ergonomic Office Chair',
      description:
        'Kursi kerja dengan sandaran mesh berpori, penopang pinggang (lumbar support) adaptif, dan armrest 3D untuk kenyamanan kerja berjam-jam.',
      price: 1450000,
      stock: 8,
      imageUrl:
        'https://images.unsplash.com/photo-1505797149-43b0069ec26b?w=500&q=80',
    },
    {
      storeId: storeCemara.id,
      categoryId: categories['Makanan & Minuman'],
      name: 'Premium Artisan Coffee Beans 250g',
      description:
        'Biji kopi Arabika pilihan single-origin dari dataran tinggi Gayo, dipanggang dengan profil medium roast untuk mengeluarkan rasa buah yang kaya.',
      price: 950000,
      stock: 40,
      imageUrl:
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=500&q=80',
    },
  ];

  for (const prod of productsData) {
    await prisma.product.create({ data: prod });
  }
  console.log('📦 [SEEDER] Katalog produk unggulan berhasil diunggah.');

  // ------------------------------------------------------------
  // 8. SEED VOUCHER PROMO (DISKON)
  // ------------------------------------------------------------
  await prisma.voucher.create({
    data: {
      code: 'SEAPEDIA10',
      discountPercent: 10,
      maxDiscount: 50000,
      isActive: true,
    },
  });
  await prisma.voucher.create({
    data: {
      code: 'CEMARABOYS',
      discountPercent: 20,
      maxDiscount: 100000,
      isActive: true,
    },
  });

  console.log('🎟️ [SEEDER] Voucher promosi diaktifkan.');
  console.log('============================================================');
  console.log(
    '✅ [SUCCESS] Seluruh data ekosistem SEAPEDIA berhasil di-seed secara atomik!',
  );
  console.log(
    '💡 [INFO] Silakan login dengan email di atas, password default: password123',
  );
  console.log('============================================================');
}

main()
  .catch((e) => {
    console.error('❌ [ERROR] Proses seeding gagal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
