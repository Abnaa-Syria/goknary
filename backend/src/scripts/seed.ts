import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { slugify } from '../lib/utils';

const prisma = new PrismaClient();

// Helper to get random image from imgs folder
const getRandomImage = (index: number = 0): string => {
  const images = [
    'adrian-regeci-XDykiiRUEoQ-unsplash.jpg',
    'alex-lvrs-mTw_GePuRUE-unsplash.jpg',
    'antonin-fels-OdqmOsUgNwk-unsplash.jpg',
    'c-d-x-PDX_a_82obo-unsplash (1).jpg',
    'curology-DGH1u80sZik-unsplash.jpg',
    'daniel-korpai-hbTKIbuMmBI-unsplash.jpg',
    'fernando-andrade-potCPE_Cw8A-unsplash.jpg',
    'francesca-grima-vwZo1zAYPws-unsplash.jpg',
    'howard-bouchevereau-kDCIBGqU0_0-unsplash.jpg',
    'irene-kredenets-dwKiHoqqxk8-unsplash.jpg',
    'j-luis-esquivel-ArGvQkA7iOw-unsplash.jpg',
    'julian-o-hayon-Bs-zngH79Ds-unsplash.jpg',
    'klim-musalimov-i2lUCneGjf8-unsplash.jpg',
    'laura-chouette-_ODRA1MPL1I-unsplash.jpg',
    'laura-chouette-dcbz31jdsHA-unsplash.jpg',
    'lina-verovaya-F39Yk-FM_fg-unsplash.jpg',
    'malvestida-u79wy47kvVs-unsplash.jpg',
    'mathilde-langevin-baKm-5z7ikk-unsplash.jpg',
    'michael-soledad-eqKBsh9qgrQ-unsplash.jpg',
    'nubelson-fernandes-38tvNzbF0ik-unsplash.jpg',
    'nubelson-fernandes-SL39K1aei60-unsplash.jpg',
    'obi-eZFPIyjJQxM-unsplash.jpg',
    'pmv-chamara-CeQiQxNNdUM-unsplash.jpg',
    'pmv-chamara-MEsWk-dZzlI-unsplash.jpg',
    'priscilla-du-preez-5NQkmZyT03s-unsplash.jpg',
    'rachit-tank-2cFZ_FB08UM-unsplash.jpg',
    'reuben-mansell-nwOip8AOZz0-unsplash.jpg',
    'ryan-waring-164_6wVEHfI-unsplash.jpg',
    'sam-grozyan-nXuq06bqu9o-unsplash.jpg',
    'sam-grozyan-Vtb6yPiZhA0-unsplash.jpg',
    'sam-pak-CYOgEE-x33U-unsplash.jpg',
    'shreesha-bhat-IS9ICGyPvPc-unsplash.jpg',
  ];
  return `/imgs/${images[index % images.length]}`;
};

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.commission.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.address.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.homeSection.deleteMany();
  await prisma.banner.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.brand.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Admin User
  console.log('👤 Creating admin user...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@goknary.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Admin User',
      emailVerified: true,
    },
  });

  // Create Categories
  console.log('📁 Creating categories...');
  const categoriesData = [
    {
      name: 'Electronics',
      nameAr: 'إلكترونيات',
      slug: 'electronics',
      image: getRandomImage(0),
      children: [
        { name: 'Smartphones', nameAr: 'هواتف ذكية', slug: 'smartphones' },
        { name: 'Laptops', nameAr: 'لابتوبات', slug: 'laptops' },
        { name: 'Headphones', nameAr: 'سماعات', slug: 'headphones' },
        { name: 'Cameras', nameAr: 'كاميرات', slug: 'cameras' },
      ],
    },
    {
      name: 'Fashion',
      nameAr: 'أزياء',
      slug: 'fashion',
      image: getRandomImage(1),
      children: [
        { name: 'Men\'s Clothing', nameAr: 'ملابس رجالية', slug: 'mens-clothing' },
        { name: 'Women\'s Clothing', nameAr: 'ملابس نسائية', slug: 'womens-clothing' },
        { name: 'Shoes', nameAr: 'أحذية', slug: 'shoes' },
        { name: 'Accessories', nameAr: 'إكسسوارات', slug: 'accessories' },
      ],
    },
    {
      name: 'Home & Kitchen',
      nameAr: 'المنزل والمطبخ',
      slug: 'home-kitchen',
      image: getRandomImage(2),
      children: [
        { name: 'Furniture', nameAr: 'أثاث', slug: 'furniture' },
        { name: 'Kitchen Appliances', nameAr: 'أجهزة المطبخ', slug: 'kitchen-appliances' },
        { name: 'Home Decor', nameAr: 'ديكور منزلي', slug: 'home-decor' },
        { name: 'Bedding', nameAr: 'مفروشات', slug: 'bedding' },
      ],
    },
    {
      name: 'Beauty & Personal Care',
      nameAr: 'الجمال والعناية الشخصية',
      slug: 'beauty',
      image: getRandomImage(3),
      children: [
        { name: 'Skincare', nameAr: 'العناية بالبشرة', slug: 'skincare' },
        { name: 'Makeup', nameAr: 'مكياج', slug: 'makeup' },
        { name: 'Fragrances', nameAr: 'عطور', slug: 'fragrances' },
        { name: 'Hair Care', nameAr: 'العناية بالشعر', slug: 'hair-care' },
      ],
    },
    {
      name: 'Sports & Outdoors',
      nameAr: 'الرياضة والأنشطة الخارجية',
      slug: 'sports-outdoors',
      image: getRandomImage(4),
      children: [
        { name: 'Fitness Equipment', nameAr: 'معدات اللياقة', slug: 'fitness-equipment' },
        { name: 'Outdoor Gear', nameAr: 'معدات التخييم', slug: 'outdoor-gear' },
        { name: 'Sports Apparel', nameAr: 'ملابس رياضية', slug: 'sports-apparel' },
      ],
    },
    {
      name: 'Books & Media',
      nameAr: 'كتب ووسائط',
      slug: 'books-media',
      image: getRandomImage(5),
      children: [
        { name: 'Books', nameAr: 'كتب', slug: 'books' },
        { name: 'Movies & TV', nameAr: 'أفلام ومسلسلات', slug: 'movies-tv' },
        { name: 'Music', nameAr: 'موسيقى', slug: 'music' },
      ],
    },
  ];

  const createdCategories: { [key: string]: any } = {};

  for (const cat of categoriesData) {
    const parent = await prisma.category.create({
      data: {
        name: cat.name,
        nameAr: cat.nameAr,
        slug: cat.slug,
        image: cat.image,
        orderIndex: categoriesData.indexOf(cat),
      },
    });
    createdCategories[cat.slug] = parent;

    for (const child of cat.children) {
      const childCat = await prisma.category.create({
        data: {
          name: child.name,
          nameAr: child.nameAr,
          slug: child.slug,
          parentId: parent.id,
        },
      });
      createdCategories[child.slug] = childCat;
    }
  }

  // Create Brands
  console.log('🏷️ Creating brands...');
  const brandsData = [
    { name: 'Apple', nameAr: 'آبل' },
    { name: 'Samsung', nameAr: 'سامسونج' },
    { name: 'Sony', nameAr: 'سوني' },
    { name: 'Nike', nameAr: 'نايكي' },
    { name: 'Adidas', nameAr: 'أديداس' },
    { name: 'Zara', nameAr: 'زارا' },
    { name: 'H&M', nameAr: 'إتش آند إم' },
    { name: 'LG', nameAr: 'إل جي' },
    { name: 'Dell', nameAr: 'ديل' },
    { name: 'HP', nameAr: 'إتش بي' },
    { name: 'Canon', nameAr: 'كانون' },
    { name: 'Nikon', nameAr: 'نيكون' },
    { name: 'Microsoft', nameAr: 'مايكروسوفت' },
    { name: 'Google', nameAr: 'جوجل' },
    { name: 'Xiaomi', nameAr: 'شاومي' },
    { name: 'Huawei', nameAr: 'هواوي' },
    { name: 'OnePlus', nameAr: 'ون بلس' },
    { name: 'Lenovo', nameAr: 'لينوفو' },
    { name: 'Asus', nameAr: 'أسوس' },
    { name: 'Intel', nameAr: 'إنتل' },
    { name: 'Amazon', nameAr: 'أمازون' },
    { name: 'Philips', nameAr: 'فيليبس' },
    { name: 'Bosch', nameAr: 'بوش' },
    { name: 'IKEA', nameAr: 'إيكيا' },
    { name: 'Puma', nameAr: 'بوما' },
  ];

  const createdBrands: { [key: string]: any } = {};

  for (let i = 0; i < brandsData.length; i++) {
    const brandData = brandsData[i];
    const brand = await prisma.brand.create({
      data: {
        name: brandData.name,
        nameAr: brandData.nameAr,
        slug: slugify(brandData.name),
        logo: getRandomImage(i),
      },
    });
    createdBrands[brandData.name] = brand;
  }

  // Create Vendor Users and Vendors
  console.log('🏪 Creating vendors...');
  const vendorsData = [
    { name: 'TechStore Pro', nameAr: 'تك ستور برو', email: 'vendor1@goknary.com', rating: 4.8 },
    { name: 'Fashion Hub', nameAr: 'مركز الأزياء', email: 'vendor2@goknary.com', rating: 4.6 },
    { name: 'Home Essentials', nameAr: 'أساسيات المنزل', email: 'vendor3@goknary.com', rating: 4.7 },
    { name: 'Beauty World', nameAr: 'عالم الجمال', email: 'vendor4@goknary.com', rating: 4.9 },
    { name: 'Sports Zone', nameAr: 'منطقة الرياضة', email: 'vendor5@goknary.com', rating: 4.5 },
    { name: 'ElectroMart', nameAr: 'إلكترو مارت', email: 'vendor6@goknary.com', rating: 4.6 },
    { name: 'Style Shop', nameAr: 'متجر الأناقة', email: 'vendor7@goknary.com', rating: 4.7 },
    { name: 'Kitchen Pro', nameAr: 'محترف المطبخ', email: 'vendor8@goknary.com', rating: 4.8 },
    { name: 'Book Paradise', nameAr: 'جنة الكتب', email: 'vendor9@goknary.com', rating: 4.6 },
    { name: 'Gadget World', nameAr: 'عالم الأجهزة', email: 'vendor10@goknary.com', rating: 4.7 },
    { name: 'Fashionista', nameAr: 'فاشنيستا', email: 'vendor11@goknary.com', rating: 4.8 },
    { name: 'Home Decor Plus', nameAr: 'ديكور منزلي بلس', email: 'vendor12@goknary.com', rating: 4.6 },
  ];

  const createdVendors: any[] = [];

  for (const vendorData of vendorsData) {
    const user = await prisma.user.create({
      data: {
        email: vendorData.email,
        passwordHash,
        role: 'VENDOR',
        name: vendorData.name,
        emailVerified: true,
      },
    });

    const vendor = await prisma.vendor.create({
      data: {
        userId: user.id,
        storeName: vendorData.name,
        storeNameAr: vendorData.nameAr,
        slug: slugify(vendorData.name),
        description: `Welcome to ${vendorData.name}! We offer the best products in our category.`,
        descriptionAr: `مرحباً بكم في ${vendorData.nameAr}! نقدم أفضل المنتجات في فئتنا.`,
        logo: getRandomImage(vendorsData.indexOf(vendorData)),
        banner: getRandomImage(vendorsData.indexOf(vendorData) + 1),
        rating: vendorData.rating,
        totalReviews: Math.floor(Math.random() * 500) + 50,
        status: 'APPROVED',
        verified: true,
        commissionRate: 10 + Math.random() * 5,
      },
    });

    createdVendors.push(vendor);
  }

  // Create Customer Users
  console.log('👥 Creating customers...');
  const customers = [];
  for (let i = 1; i <= 15; i++) {
    const customer = await prisma.user.create({
      data: {
        email: `customer${i}@goknary.com`,
        passwordHash,
        role: 'CUSTOMER',
        name: `Customer ${i}`,
        emailVerified: true,
      },
    });
    customers.push(customer);
  }

  // Create Products
  console.log('📦 Creating products...');
  // Product name translations
  const productTranslations: { [key: string]: string } = {
    'iPhone 15 Pro Max': 'آيفون 15 برو ماكس',
    'Samsung Galaxy S24 Ultra': 'سامسونج جالاكسي S24 ألترا',
    'MacBook Pro M3': 'ماك بوك برو M3',
    'Dell XPS 15': 'ديل XPS 15',
    'Sony WH-1000XM5 Headphones': 'سماعات سوني WH-1000XM5',
    'AirPods Pro': 'إيربودز برو',
    'Canon EOS R6': 'كاميرا كانون EOS R6',
    'Nikon D850': 'كاميرا نيكون D850',
    'iPad Pro': 'آيباد برو',
    'Samsung 4K Smart TV': 'تلفزيون سامسونج 4K ذكي',
    'LG OLED TV': 'تلفزيون LG OLED',
    'PlayStation 5': 'بلايستيشن 5',
    'Men\'s Cotton T-Shirt': 'تيشيرت قطني رجالي',
    'Women\'s Summer Dress': 'فستان صيفي نسائي',
    'Nike Air Max': 'نايكي إير ماكس',
    'Adidas Running Shoes': 'حذاء أديداس للجري',
    'Leather Jacket': 'جاكيت جلد',
    'Denim Jeans': 'جينز دينم',
    'Casual Sneakers': 'أحذية رياضية كاجوال',
    'Formal Suit': 'بدلة رسمية',
    'Designer Handbag': 'حقيبة يد مصممة',
    'Sunglasses': 'نظارات شمسية',
    'Wristwatch': 'ساعة يد',
    'Leather Belt': 'حزام جلد',
    'Coffee Maker': 'صانعة قهوة',
    'Blender': 'خلاط',
    'Dining Table Set': 'طقم طاولة طعام',
    'Sofa Set': 'طقم كنب',
    'Bed Sheets Set': 'طقم ملاءات سرير',
    'Kitchen Knife Set': 'طقم سكاكين مطبخ',
    'Cookware Set': 'طقم أواني طبخ',
    'Vacuum Cleaner': 'مكنسة كهربائية',
    'Air Purifier': 'منقي هواء',
    'Desk Lamp': 'مصباح مكتب',
    'Wall Clock': 'ساعة حائط',
    'Throw Pillows': 'وسائد ديكور',
    'Face Cleanser': 'غسول وجه',
    'Moisturizer': 'مرطب بشرة',
    'Lipstick Set': 'طقم أحمر شفاه',
    'Perfume': 'عطر',
    'Hair Shampoo': 'شامبو شعر',
    'Face Mask': 'قناع وجه',
    'Sunscreen': 'واقي شمس',
    'Makeup Brush Set': 'طقم فرش مكياج',
    'Nail Polish': 'طلاء أظافر',
    'Body Lotion': 'لوشن جسم',
    'Serum': 'سيروم',
    'Tonner': 'تونر',
    'Yoga Mat': 'سجادة يوجا',
    'Dumbbell Set': 'طقم دمبل',
    'Running Shoes': 'حذاء جري',
    'Sports Watch': 'ساعة رياضية',
    'Tennis Racket': 'مضرب تنس',
    'Basketball': 'كرة سلة',
    'Gym Bag': 'حقيبة رياضة',
    'Water Bottle': 'زجاجة مياه',
    'Resistance Bands': 'أشرطة مقاومة',
    'Foam Roller': 'أسطوانة فوم',
    'Jump Rope': 'حبل قفز',
    'Exercise Ball': 'كرة تمارين',
  };

  const productNames = [
    // Electronics
    'iPhone 15 Pro Max', 'Samsung Galaxy S24 Ultra', 'MacBook Pro M3', 'Dell XPS 15',
    'Sony WH-1000XM5 Headphones', 'AirPods Pro', 'Canon EOS R6', 'Nikon D850',
    'iPad Pro', 'Samsung 4K Smart TV', 'LG OLED TV', 'PlayStation 5',
    
    // Fashion
    'Men\'s Cotton T-Shirt', 'Women\'s Summer Dress', 'Nike Air Max', 'Adidas Running Shoes',
    'Leather Jacket', 'Denim Jeans', 'Casual Sneakers', 'Formal Suit',
    'Designer Handbag', 'Sunglasses', 'Wristwatch', 'Leather Belt',
    
    // Home & Kitchen
    'Coffee Maker', 'Blender', 'Dining Table Set', 'Sofa Set',
    'Bed Sheets Set', 'Kitchen Knife Set', 'Cookware Set', 'Vacuum Cleaner',
    'Air Purifier', 'Desk Lamp', 'Wall Clock', 'Throw Pillows',
    
    // Beauty
    'Face Cleanser', 'Moisturizer', 'Lipstick Set', 'Perfume',
    'Hair Shampoo', 'Face Mask', 'Sunscreen', 'Makeup Brush Set',
    'Nail Polish', 'Body Lotion', 'Serum', 'Tonner',
    
    // Sports
    'Yoga Mat', 'Dumbbell Set', 'Running Shoes', 'Sports Watch',
    'Tennis Racket', 'Basketball', 'Gym Bag', 'Water Bottle',
    'Resistance Bands', 'Foam Roller', 'Jump Rope', 'Exercise Ball',
  ];

  const categoryMappings: { [key: string]: string[] } = {
    'smartphones': ['iPhone 15 Pro Max', 'Samsung Galaxy S24 Ultra'],
    'laptops': ['MacBook Pro M3', 'Dell XPS 15', 'iPad Pro'],
    'headphones': ['Sony WH-1000XM5 Headphones', 'AirPods Pro'],
    'cameras': ['Canon EOS R6', 'Nikon D850'],
    'mens-clothing': ['Men\'s Cotton T-Shirt', 'Leather Jacket', 'Denim Jeans', 'Formal Suit'],
    'womens-clothing': ['Women\'s Summer Dress'],
    'shoes': ['Nike Air Max', 'Adidas Running Shoes', 'Casual Sneakers', 'Running Shoes'],
    'kitchen-appliances': ['Coffee Maker', 'Blender', 'Kitchen Knife Set', 'Cookware Set'],
    'furniture': ['Dining Table Set', 'Sofa Set'],
    'bedding': ['Bed Sheets Set', 'Throw Pillows'],
    'skincare': ['Face Cleanser', 'Moisturizer', 'Face Mask', 'Sunscreen', 'Serum', 'Tonner'],
    'makeup': ['Lipstick Set', 'Makeup Brush Set', 'Nail Polish'],
    'fragrances': ['Perfume'],
    'fitness-equipment': ['Yoga Mat', 'Dumbbell Set', 'Resistance Bands', 'Foam Roller', 'Exercise Ball'],
  };

  const createdProducts: any[] = [];

  for (const productName of productNames) {
    // Find category for product
    let categoryId = createdCategories['electronics']?.id;
    for (const [catSlug, names] of Object.entries(categoryMappings)) {
      if (names.includes(productName) && createdCategories[catSlug]) {
        categoryId = createdCategories[catSlug].id;
        break;
      }
    }

    // Random vendor
    const vendor = createdVendors[Math.floor(Math.random() * createdVendors.length)];
    
    // Random brand (if electronics/fashion related)
    let brandId = null;
    if (productName.includes('iPhone') || productName.includes('MacBook') || productName.includes('iPad') || productName.includes('AirPods')) {
      brandId = createdBrands['Apple']?.id;
    } else if (productName.includes('Samsung') || productName.includes('Galaxy')) {
      brandId = createdBrands['Samsung']?.id;
    } else if (productName.includes('Nike')) {
      brandId = createdBrands['Nike']?.id;
    } else if (productName.includes('Adidas')) {
      brandId = createdBrands['Adidas']?.id;
    } else {
      const randomBrand = Object.values(createdBrands)[Math.floor(Math.random() * Object.keys(createdBrands).length)];
      brandId = randomBrand?.id;
    }

    const basePrice = 50 + Math.random() * 950;
    const hasDiscount = Math.random() > 0.3;
    const discountPrice = hasDiscount ? basePrice * (0.7 + Math.random() * 0.2) : null;
    const rating = 3.5 + Math.random() * 1.5;
    const ratingCount = Math.floor(Math.random() * 500);

    const nameAr = productTranslations[productName] || productName;
    const product = await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId,
        brandId,
        name: productName,
        nameAr: nameAr,
        slug: slugify(productName),
        description: `High-quality ${productName}. Perfect for your needs.`,
        descriptionAr: `${nameAr} عالي الجودة. مثالي لاحتياجاتك.`,
        sku: `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        price: Math.round(basePrice * 100) / 100,
        discountPrice: discountPrice ? Math.round(discountPrice * 100) / 100 : null,
        stock: Math.floor(Math.random() * 100) + 10,
        ratingAvg: Math.round(rating * 10) / 10,
        ratingCount,
        images: JSON.stringify([
          getRandomImage(productNames.indexOf(productName)),
          getRandomImage(productNames.indexOf(productName) + 1),
          getRandomImage(productNames.indexOf(productName) + 2),
        ]),
        status: 'ACTIVE',
        featured: Math.random() > 0.7,
      },
    });

    createdProducts.push(product);
  }

  // Create more products to reach 250+
  const additionalProducts = 250 - productNames.length;
  const additionalNames = [
    { name: 'Wireless Mouse', nameAr: 'ماوس لاسلكي' },
    { name: 'Keyboard', nameAr: 'لوحة مفاتيح' },
    { name: 'Monitor', nameAr: 'شاشة' },
    { name: 'Speakers', nameAr: 'مكبرات صوت' },
    { name: 'Tablet', nameAr: 'تابلت' },
    { name: 'Smart Watch', nameAr: 'ساعة ذكية' },
    { name: 'Power Bank', nameAr: 'شاحن محمول' },
    { name: 'USB Cable', nameAr: 'كابل USB' },
    { name: 'Charger', nameAr: 'شاحن' },
    { name: 'Case', nameAr: 'غطاء حماية' },
    { name: 'Screen Protector', nameAr: 'حامي الشاشة' },
    { name: 'Laptop Stand', nameAr: 'حامل لابتوب' },
    { name: 'Webcam', nameAr: 'كاميرا ويب' },
    { name: 'Microphone', nameAr: 'ميكروفون' },
    { name: 'Gaming Chair', nameAr: 'كرسي ألعاب' },
    { name: 'Desk', nameAr: 'مكتب' },
    { name: 'Bookshelf', nameAr: 'رف كتب' },
    { name: 'Rug', nameAr: 'سجادة' },
    { name: 'Curtains', nameAr: 'ستائر' },
    { name: 'Mirror', nameAr: 'مرآة' },
    { name: 'Plant Pot', nameAr: 'وعاء نبات' },
    { name: 'Vase', nameAr: 'مزهرية' },
    { name: 'Picture Frame', nameAr: 'إطار صورة' },
    { name: 'Candles', nameAr: 'شموع' },
  ];

  for (let i = 0; i < additionalProducts; i++) {
    const productData = additionalNames[i % additionalNames.length];
    const name = productData.name + ` ${Math.floor(i / additionalNames.length) + 1}`;
    const nameAr = productData.nameAr + ` ${Math.floor(i / additionalNames.length) + 1}`;
    const vendor = createdVendors[Math.floor(Math.random() * createdVendors.length)];
    const categoryKeys = Object.keys(createdCategories);
    const randomCategory = createdCategories[categoryKeys[Math.floor(Math.random() * categoryKeys.length)]];
    
    const basePrice = 20 + Math.random() * 480;
    const hasDiscount = Math.random() > 0.4;
    const discountPrice = hasDiscount ? basePrice * (0.75 + Math.random() * 0.2) : null;

    await prisma.product.create({
      data: {
        vendorId: vendor.id,
        categoryId: randomCategory.id,
        brandId: Object.values(createdBrands)[Math.floor(Math.random() * Object.keys(createdBrands).length)]?.id || null,
        name,
        nameAr,
        slug: slugify(name),
        description: `Quality ${name} for your needs.`,
        descriptionAr: `${nameAr} عالي الجودة لاحتياجاتك.`,
        sku: `SKU-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        price: Math.round(basePrice * 100) / 100,
        discountPrice: discountPrice ? Math.round(discountPrice * 100) / 100 : null,
        stock: Math.floor(Math.random() * 50) + 5,
        ratingAvg: Math.round((3 + Math.random() * 2) * 10) / 10,
        ratingCount: Math.floor(Math.random() * 200),
        images: JSON.stringify([getRandomImage(i)]),
        status: 'ACTIVE',
        featured: Math.random() > 0.8,
      },
    });
  }

  // Create Reviews
  console.log('⭐ Creating reviews...');
  
  // Helper function to get random unique subset (Fisher-Yates shuffle)
  const getRandomSubset = <T,>(array: T[], count: number): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length));
  };
  
  // Track created reviews to avoid duplicates
  const createdReviews = new Set<string>();
  
  for (const product of createdProducts.slice(0, 75)) {
    const numReviews = Math.min(
      Math.floor(Math.random() * 3) + 1,
      customers.length
    );
    
    // Get unique random customers for this product (without replacement)
    const productCustomers = getRandomSubset(customers, numReviews);
    
    for (const customer of productCustomers) {
      const reviewKey = `${product.id}-${customer.id}`;
      
      // Skip if this review already exists
      if (createdReviews.has(reviewKey)) {
        continue;
      }
      
      const rating = Math.floor(Math.random() * 5) + 1;
      
      try {
        await prisma.review.create({
          data: {
            productId: product.id,
            userId: customer.id,
            rating,
            title: rating >= 4 ? 'Great product!' : rating >= 3 ? 'Good product' : 'Could be better',
            comment: rating >= 4
              ? 'Really happy with this purchase. Quality is excellent!'
              : rating >= 3
              ? 'Decent product, meets expectations.'
              : 'Not what I expected, but okay for the price.',
          },
        });
        createdReviews.add(reviewKey);
      } catch (error: any) {
        // Skip if review already exists (unique constraint violation)
        if (error.code === 'P2002') {
          createdReviews.add(reviewKey);
          continue;
        }
        // Re-throw other errors
        throw error;
      }
    }
  }

  // Update product ratings based on reviews
  const productsWithReviews = await prisma.product.findMany({
    include: {
      reviews: true,
    },
  });

  for (const product of productsWithReviews) {
    if (product.reviews.length > 0) {
      const avgRating = product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length;
      await prisma.product.update({
        where: { id: product.id },
        data: {
          ratingAvg: Math.round(avgRating * 10) / 10,
          ratingCount: product.reviews.length,
        },
      });
    }
  }

  // Create Banners
  console.log('🖼️ Creating banners...');
  const bannerData = [
    { title: 'Summer Sale - Up to 50% Off', titleAr: 'تخفيضات الصيف - خصم يصل إلى 50%' },
    { title: 'New Arrivals', titleAr: 'وصل حديثاً' },
    { title: 'Tech Deals', titleAr: 'عروض التقنية' },
    { title: 'Fashion Week', titleAr: 'أسبوع الموضة' },
    { title: 'Home Essentials', titleAr: 'أساسيات المنزل' },
    { title: 'Beauty Products', titleAr: 'منتجات الجمال' },
    { title: 'Sports Gear', titleAr: 'معدات رياضية' },
    { title: 'Best Sellers', titleAr: 'الأكثر مبيعاً' },
    { title: 'Flash Sale', titleAr: 'عروض فلاش' },
    { title: 'Weekend Special', titleAr: 'عروض نهاية الأسبوع' },
  ];

  for (let i = 0; i < 25; i++) {
    const banner = bannerData[i % bannerData.length];
    await prisma.banner.create({
      data: {
        title: banner.title,
        titleAr: banner.titleAr,
        imageUrl: getRandomImage(i),
        linkUrl: `/category/${Object.keys(createdCategories)[i % Object.keys(createdCategories).length]}`,
        type: i < 5 ? 'HERO' : 'PROMO',
        orderIndex: i,
        status: true,
      },
    });
  }

  // Create Home Sections
  console.log('🏠 Creating home sections...');
  await prisma.homeSection.createMany({
    data: [
      { type: 'top_deals', title: 'Top Deals', titleAr: 'أفضل العروض', configJson: '{}', orderIndex: 0, status: true },
      { type: 'trending', title: 'Trending Now', titleAr: 'الأكثر رواجاً الآن', configJson: '{}', orderIndex: 1, status: true },
      { type: 'best_sellers', title: 'Best Sellers', titleAr: 'الأكثر مبيعاً', configJson: '{}', orderIndex: 2, status: true },
      { type: 'recommended', title: 'Recommended For You', titleAr: 'موصى به لك', configJson: '{}', orderIndex: 3, status: true },
    ],
  });

  // Create Sample Orders
  console.log('📝 Creating sample orders...');
  for (let i = 0; i < 30; i++) {
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const vendor = createdVendors[Math.floor(Math.random() * createdVendors.length)];
    const vendorProducts = createdProducts.filter(p => p.vendorId === vendor.id);
    
    if (vendorProducts.length === 0) continue;

    const numItems = Math.floor(Math.random() * 3) + 1;
    const selectedProducts = vendorProducts.slice(0, numItems);
    
    const subtotal = selectedProducts.reduce((sum, p) => {
      return sum + (p.discountPrice || p.price);
    }, 0);
    
    const shippingCost = 50;
    const total = subtotal + shippingCost;

    const order = await prisma.order.create({
      data: {
        userId: customer.id,
        vendorId: vendor.id,
        status: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'][Math.floor(Math.random() * 5)],
        subtotal,
        shippingCost,
        total,
        addressJson: JSON.stringify({
          fullName: customer.name,
          phone: '+201234567890',
          addressLine1: '123 Main St',
          city: 'Cairo',
          country: 'Egypt',
        }),
        shippingMethod: 'Standard',
      },
    });

    // Create order items
    for (const product of selectedProducts) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          productId: product.id,
          quantity: Math.floor(Math.random() * 3) + 1,
          price: product.price,
          discountPrice: product.discountPrice,
        },
      });
    }

    // Create order status history
    await prisma.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: order.status,
        notes: 'Order created',
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log(`📊 Created:`);
  console.log(`   - ${categoriesData.length} parent categories with subcategories`);
  console.log(`   - ${brandsData.length} brands`);
  console.log(`   - ${vendorsData.length} vendors`);
  console.log(`   - ${customers.length} customers`);
  console.log(`   - ${createdProducts.length}+ products`);
  console.log(`   - 25 banners`);
  console.log(`   - 30 sample orders`);
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

