import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { slugify } from '../lib/utils';

const prisma = new PrismaClient();

// Helper to get random image URLs (Unsplash)
const getRandomImage = (index: number = 0): string => {
  const images = [
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1585386959984-a4155224a1ad?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1511556532299-8f662fc26c06?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1592878849122-5a5f9f77f709?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1483982258113-b72862e6cff6?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1470259078422-826894b933aa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1611930021592-a8cfd5319ceb?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1591375275624-cf1c26a49b9d?auto=format&fit=crop&w=1200&q=80',
  ];
  return images[index % images.length];
};

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.ticketMessage.deleteMany();
  await prisma.supportTicket.deleteMany();
  await prisma.refundRequest.deleteMany();
  await prisma.payoutRequest.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.commission.deleteMany();
  await prisma.orderStatusHistory.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.review.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.compareItem.deleteMany();
  await prisma.productVariant.deleteMany();
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

  // Create settings
  console.log('⚙️ Seeding system settings...');
  
  const termsOfServiceEn = `# Terms of Service
*Last Updated: June 8, 2026*

Welcome to GoKnary! These Terms of Service ("Terms") govern your access to and use of GoKnary's website, mobile applications, and services. By using our platform, you agree to comply with and be bound by these Terms.

## 1. Description of Service
GoKnary is a multi-vendor e-commerce platform that connects independent merchants ("Vendors") with buyers ("Customers"). GoKnary facilitates transactions, payments, and customer support, but is not the direct seller of products listed by third-party Vendors.

## 2. User Accounts
* **Eligibility**: You must be at least 18 years old or the age of legal majority in your jurisdiction to create an account.
* **Account Security**: You are responsible for safeguarding your password and account credentials. Any activities under your account are your sole responsibility.
* **Accuracy of Information**: You agree to provide accurate, current, and complete information during signup and keep your account details updated.

## 3. Purchasing and Payments
* **Orders**: All orders are subject to acceptance by the respective Vendor. Order confirmation does not signify our acceptance of your order.
* **Pricing**: Prices are set by Vendors and may change at any time. Delivery charges and applicable taxes will be added during checkout.
* **Payment Methods**: We support Cash on Delivery (COD) and other secure electronic payment options as shown on the platform.

## 4. Vendor Responsibilities
* **Product Catalog**: Vendors are solely responsible for the accuracy of their product listings, including description, price, variants, and stock levels.
* **Fulfillment**: Vendors must ship products in accordance with platform policies and within the specified timeframes.

## 5. Refunds and Return Policy
* **Returns**: Customers may request refunds or returns through their dashboard within the period allowed by local consumer protection laws.
* **Refund Decisions**: Return approvals are subject to verification of product condition. Shipping costs are non-refundable unless the product is defective.

## 6. Prohibited Activities
You agree not to use the platform for any illegal purposes, including:
1. Posting fraudulent listings or reviews.
2. Infringing on intellectual property rights.
3. Accessing or attempting to access restricted database areas.

## 7. Governing Law
These Terms are governed by and construed in accordance with the laws of the Arab Republic of Egypt, without regard to its conflict of law principles.

---
If you have any questions about these Terms, please contact us at support@goknary.com.`;

  const termsOfServiceAr = `# شروط الخدمة
*آخر تحديث: 8 يونيو 2026*

مرحباً بكم في جو كناري (GoKnary)! تحكم شروط الخدمة هذه ("الشروط") وصولكم واستخدامكم لموقع جو كناري وتطبيقات الهاتف المحمول والخدمات التابعة له. باستخدامكم لمنصتنا، فإنكم توافقون على الامتثال لهذه الشروط والالتزام بها.

## 1. وصف الخدمة
جو كناري هي منصة تجارة إلكترونية متعددة التجار تربط بين التجار المستقلين ("البائعين") والمشترين ("العملاء"). يسهل جو كناري المعاملات والمدفوعات ودعم العملاء، ولكنه ليس البائع المباشر للمنتجات المدرجة من قبل بائعي الطرف الثالث.

## 2. حسابات المستخدمين
* **الأهلية**: يجب أن لا يقل عمرك عن 18 عاماً أو سن الرشد القانوني في بلدك لإنشاء حساب.
* **أمن الحساب**: أنت مسؤول عن حماية كلمة المرور وبيانات اعتماد حسابك. وتتحمل المسؤولية الكاملة عن أي أنشطة تتم تحت حسابك.
* **دقة المعلومات**: توافق على تقديم معلومات دقيقة وحديثة وكاملة أثناء التسجيل وتحديث بيانات حسابك باستمرار.

## 3. الشراء والمدفوعات
* **الطلبات**: تخضع جميع الطلبات للقبول من قبل البائع المعني. لا يعني تأكيد الطلب قبولنا النهائي له.
* **الأسعار**: يتم تحديد الأسعار من قبل البائعين وهي قابلة للتغيير في أي وقت. سيتم إضافة رسوم التوصيل والضرائب المطبقة أثناء إتمام عملية الشراء.
* **طرق الدفع**: نحن ندعم الدفع عند الاستلام (COD) وخيارات الدفع الإلكتروني الآمنة الأخرى كما تظهر على المنصة.

## 4. مسؤوليات البائعين
* **كتالوج المنتجات**: البائعون مسؤولون وحدهم عن دقة قوائم منتجاتهم، بما في ذلك الوصف والسعر والموديلات ومستويات المخزون.
* **تلبية الطلبات**: يجب على البائعين شحن المنتجات وفقاً لسياسات المنصة وخلال الأطر الزمنية المحددة.

## 5. سياسة الاسترجاع والاسترداد
* **المرتجعات**: يجوز للعملاء طلب استرداد الأموال أو إرجاع المنتجات من خلال لوحة التحكم الخاصة بهم خلال الفترة المسموح بها بموجب قوانين حماية المستهلك المحلية.
* **قرارات الاسترداد**: تخضع الموافقات على المرتجعات للتحقق من حالة المنتج. رسوم الشحن غير قابلة للاسترداد إلا إذا كان المنتج معيباً.

## 6. الأنشطة المحظورة
توافق على عدم استخدام المنصة لأي أغراض غير قانونية، بما في ذلك:
1. نشر تقييمات أو قوائم منتجات احتيالية.
2. انتهاك حقوق الملكية الفكرية.
3. الوصول أو محاولة الوصول إلى مناطق قاعدة البيانات المقيدة.

## 7. القانون الحاكم
تخضع هذه الشروط وتُفسر وفقاً لقوانين جمهورية مصر العربية، دون النظر إلى تعارضها مع مبادئ القانون.

---
إذا كان لديك أي أسئلة حول هذه الشروط، يرجى الاتصال بنا على support@goknary.com.`;

  const privacyPolicyEn = `# Privacy Policy
*Last Updated: June 8, 2026*

At GoKnary, we respect your privacy and are committed to protecting your personal data. This Privacy Policy describes how we collect, use, disclose, and safeguard your information when you visit our website or use our services.

## 1. Information We Collect
We collect several types of information to provide and improve our services:
* **Personal Identifiers**: Name, email address, phone number, and delivery address.
* **Transaction Details**: Details of products purchased, billing information, and history.
* **Technical Information**: IP address, browser type, device details, and cookie data.

## 2. How We Use Your Information
We process your personal information for the following purposes:
* To process, fulfill, and track your orders.
* To manage your account and provide customer support.
* To communicate with you regarding order updates, promotions, and newsletter subscriptions.
* To prevent fraud and ensure platform security.

## 3. How We Share Information
We do not sell your personal data to third parties. However, we may share information with:
* **Vendors**: To allow them to pack and ship the products you ordered.
* **Service Providers**: Delivery partners, payment gateways, and email marketing tools.
* **Legal Authorities**: If required to comply with applicable laws or respond to valid legal processes.

## 4. Data Security
We implement industry-standard administrative, technical, and physical security measures to protect your personal data against unauthorized access, alteration, or disclosure. However, no transmission over the Internet is 100% secure.

## 5. Your Rights and Choices
Depending on your location, you may have the following rights:
* **Access & Portability**: Request a copy of the data we hold about you.
* **Correction**: Ask us to correct inaccurate or incomplete info.
* **Deletion**: Request that we erase your personal details, subject to legal retention obligations.

---
For any privacy inquiries or to exercise your rights, please reach out to us at privacy@goknary.com.`;

  const privacyPolicyAr = `# سياسة الخصوصية
*آخر تحديث: 8 يونيو 2026*

في جو كناري، نحترم خصوصيتك ونلتزم بحماية بياناتك الشخصية. تصف سياسة الخصوصية هذه كيفية جمع معلوماتك واستخدامها والإفصاح عنها وحمايتها عند زيارتك لموقعنا الإلكتروني أو استخدام خدماتنا.

## 1. المعلومات التي نجمعها
نحن نجمع عدة أنواع من المعلومات لتقديم خدماتنا وتحسينها:
* **المعرفات الشخصية**: الاسم وعنوان البريد الإلكتروني ورقم الهاتف وعنوان التوصيل.
* **تفاصيل المعاملات**: تفاصيل المنتجات المشتراة ومعلومات الفواتير وسجل الشراء.
* **المعلومات التقنية**: عنوان IP ونوع المتصفح وتفاصيل الجهاز وبيانات ملفات تعريف الارتباط.

## 2. كيف نستخدم معلوماتك
نحن نعالج معلوماتك الشخصية للأغراض التالية:
* لمعالجة طلباتك وتلبيتها وتتبعها.
* لإدارة حسابك وتقديم دعم العملاء.
* للتواصل معك بشأن تحديثات الطلب والعروض الترويجية والرسائل الإخبارية.
* لمنع الاحتيال وضمان أمن المنصة.

## 3. مشاركة المعلومات
نحن لا نبيع بياناتك الشخصية لأطراف ثالثة. ومع ذلك، قد نشارك المعلومات مع:
* **البائعين**: لتمكينهم من تعبئة وشحن المنتجات التي طلبتها.
* **مقدمي الخدمات**: شركاء التوصيل وبوابات الدفع وأدوات التسويق عبر البريد الإلكتروني.
* **السلطات القانونية**: إذا كان ذلك مطلوباً للامتثال للقوانين المعمول بها أو الاستجابة للإجراءات القانونية الصالحة.

## 4. أمن البيانات
نحن نطبق تدائير أمنية إدارية وفنية ومادية متوافقة مع معايير الصناعة لحماية بياناتك الشخصية ضد الوصول غير المصرح به أو التغيير أو الإفصاح. ومع ذلك، لا يوجد نقل عبر الإنترنت آمن بنسبة 100%.

## 5. حقوقك وخياراتك
اعتماداً على موقعك، قد تتمتع بالحقوق التالية:
* **الوصول والنقل**: طلب نسخة من البيانات التي نحتفظ بها عنك.
* **التصحيح**: الطلب منا تصحيح المعلومات غير الدقيقة أو غير الكاملة.
* **الحذف**: طلب مسح تفاصيلك الشخصية، مع مراعاة التزامات الاحتفاظ القانونية.

---
لأية استفسارات تتعلق بالخصوصية أو لممارسة حقوقك، يرجى التواصل معنا على privacy@goknary.com.`;

  const cookiePolicyEn = `# Cookie Policy
*Last Updated: June 8, 2026*

This Cookie Policy explains how GoKnary uses cookies and similar tracking technologies to recognize you when you visit our platform.

## 1. What Are Cookies?
Cookies are small data files placed on your computer or mobile device when you visit a website. They are widely used by website owners to make their websites work more efficiently, as well as to provide reporting information.

## 2. Why Do We Use Cookies?
We use cookies for several reasons:
* **Essential Cookies**: Necessary to provide you with services available through our website (e.g. to keep you logged in and preserve items in your cart).
* **Analytics and Performance**: Help us understand how our website is being used and measure the effectiveness of marketing campaigns.
* **Functional Cookies**: Remember your language preferences and user interface choices.

## 3. How Can You Control Cookies?
You have the right to decide whether to accept or reject cookies. Most web browsers allow you to modify your settings to block cookies or notify you when they are set. Please note that if you choose to reject cookies, some features of our website may not function correctly.

---
If you have questions about our use of cookies, please email us at privacy@goknary.com.`;

  const cookiePolicyAr = `# سياسة ملفات تعريف الارتباط (Cookies)
*آخر تحديث: 8 يونيو 2026*

توضح سياسة ملفات تعريف الارتباط هذه كيف يستخدم جو كناري ملفات تعريف الارتباط وتقنيات التتبع المماثلة للتعرف عليك عند زيارتك لمنصتنا.

## 1. ما هي ملفات تعريف الارتباط (Cookies)؟
ملفات تعريف الارتباط هي ملفات بيانات صغيرة يتم وضعها على جهاز الكمبيوتر أو الهاتف المحمول الخاص بك عند زيارتك لموقع ويب. يتم استخدامها على نطاق واسع من قبل أصحاب المواقع لجعل مواقعهم تعمل بشكل أكثر كفاءة، وكذلك لتوفير معلومات التقارير.

## 2. لماذا نستخدم ملفات تعريف الارتباط؟
نحن نستخدم ملفات تعريف الارتباط لعدة أسباب:
* **ملفات تعريف الارتباط الأساسية**: ضرورية لتزويدك بالخدمات المتاحة من خلال موقعنا (مثل إبقائك قيد تسجيل الدخول وحفظ المنتجات في عربة التسوق الخاصة بك).
* **التحليلات والأداء**: تساعدنا في فهم كيفية استخدام موقعنا وقياس مدى فعالية الحملات التسويقية.
* **ملفات تعريف الارتباط الوظيفية**: تتذكر تفضيلاتك اللغوية وخيارات واجهة المستخدم الخاصة بك.

## 3. كيف يمكنك التحكم في ملفات تعريف الارتباط؟
لديك الحق في تقرير قبول أو رفض ملفات تعريف الارتباط. تسمح لك معظم متصفحات الويب بتعديل إعداداتك لحظر ملفات تعريف الارتباط أو إعلامك عند تعيينها. يرجى ملاحظة أنه إذا اخترت رفض ملفات تعريف الارتباط، فقد لا تعمل بعض ميزات موقعنا بشكل صحيح.

---
إذا كان لديك أسئلة حول استخدامنا لملفات تعريف الارتباط، يرجى مراسلتنا عبر البريد الإلكتروني على privacy@goknary.com.`;

  await prisma.setting.createMany({
    data: [
      { key: 'free_shipping_threshold', value: '500' },
      { key: 'support_phone', value: '+20 100 000 0000' },
      { key: 'facebook_url', value: 'https://facebook.com' },
      { key: 'instagram_url', value: 'https://instagram.com' },
      { key: 'linkedin_url', value: 'https://linkedin.com' },
      { key: 'twitter_url', value: 'https://twitter.com' },
      { key: 'terms_of_service', value: termsOfServiceEn },
      { key: 'terms_of_service_ar', value: termsOfServiceAr },
      { key: 'privacy_policy', value: privacyPolicyEn },
      { key: 'privacy_policy_ar', value: privacyPolicyAr },
      { key: 'cookie_policy', value: cookiePolicyEn },
      { key: 'cookie_policy_ar', value: cookiePolicyAr },
    ]
  });

  // Create Admin User
  console.log('👤 Creating admin user...');
  const admin = await prisma.user.create({
    data: {
      email: 'admin@goknary.com',
      passwordHash,
      role: 'ADMIN',
      name: 'Admin User',
      phone: '+201000000000',
      emailVerified: true,
      phoneVerified: true,
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
        phone: `+2010000001${String(vendorsData.indexOf(vendorData)).padStart(2, '0')}`,
        emailVerified: true,
        phoneVerified: true,
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
        phone: `+2011000${String(i).padStart(5, '0')}`,
        emailVerified: true,
        phoneVerified: true,
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
        status: (['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const)[Math.floor(Math.random() * 5)],
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

