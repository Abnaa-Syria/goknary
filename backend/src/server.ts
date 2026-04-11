import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';

dotenv.config();

// ─── M-01 Fix: Startup Environment Validation ─────────────────────────────────
// Fail fast — crash at startup instead of at runtime if critical env vars are missing
const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const missingEnv = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`\n❌ FATAL: Missing required environment variables:\n   ${missingEnv.join(', ')}\n`);
  console.error('   Please check your .env file and restart the server.\n');
  process.exit(1);
}

// ─── Route Imports ────────────────────────────────────────────────────────────
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import homeRoutes from './routes/home';
import vendorRoutes from './routes/vendors';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import authRoutes from './routes/auth';
import { forgotPassword, resetPassword } from './controllers/auth';
import addressRoutes from './routes/addresses';
import wishlistRoutes from './routes/wishlist';
import compareRoutes from './routes/compare';
import brandRoutes from './routes/brands';
import couponRoutes from './routes/coupons';
import notificationRoutes from './routes/notifications';
import announcementRoutes from './routes/announcements';
import adminAnnouncementRoutes from './routes/admin-announcements';

// ─── Vendor Routes (specific paths BEFORE parent path — H-03 Fix) ─────────────
import vendorProductRoutes from './routes/vendor-products';
import vendorOrderRoutes from './routes/vendor-orders';
import vendorAnalyticsRoutes from './routes/vendor-analytics';
import vendorProfileRoutes from './routes/vendor';

// ─── Admin Routes ─────────────────────────────────────────────────────────────
import adminRoutes from './routes/admin';
import adminVendorRoutes from './routes/admin-vendors';
import adminCategoryRoutes from './routes/admin-categories';
import adminBrandRoutes from './routes/admin-brands';
import adminBannerRoutes from './routes/admin-banners';
import uploadRoutes from './routes/uploads';
import shippingRoutes from './routes/shipping';
import reviewRoutes from './routes/reviews';
import { authenticate, authorize } from './middleware/auth';
import { getAdminVendorProducts } from './controllers/admin';

// ─── WhatsApp / Twilio (OTP delivery) ───────────────────────────────────────
// Twilio client is lazy-initialised inside lib/whatsapp.ts — nothing to call here.

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 5000;

// Security & parsing middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// ─── Static files (BEFORE any routers/limiters — fix #1) ──────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

console.log(path.join(process.cwd(), ''));

// Rate limiting — more lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
});
app.use('/api/', limiter);


// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'GoKnary API is running',
    timestamp: new Date().toISOString(),
  });
});

// ─── Public API Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
// Also register on the app so POST /api/auth/forgot-password always hits the handler (avoids 404 if router file was out of sync or process not restarted)
app.post('/api/auth/forgot-password', forgotPassword);
app.post('/api/auth/reset-password', resetPassword);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/announcements', announcementRoutes);

// ─── Vendor Routes (specific subroutes BEFORE parent — H-03 Fix) ──────────────
app.use('/api/vendor/products', vendorProductRoutes);
app.use('/api/vendor/orders', vendorOrderRoutes);
app.use('/api/vendor/analytics', vendorAnalyticsRoutes);
app.use('/api/vendor', vendorProfileRoutes); // parent LAST

// ─── Admin Governance Direct Routes (H-03 Route Prioritization) ───────────────
app.get('/api/admin/vendors/:vendorId/products', authenticate, authorize('ADMIN'), getAdminVendorProducts);

// ─── Admin Routes (specific subroutes BEFORE parent) ─────────────────────────
app.use('/api/admin/vendors', adminVendorRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/brands', adminBrandRoutes);
app.use('/api/admin/banners', adminBannerRoutes);
app.use('/api/admin/announcements', adminAnnouncementRoutes);
app.use('/api/admin', adminRoutes); // parent LAST

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(err.statusCode || err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\n🚀 Server running   → http://localhost:${PORT}`);
  console.log(`📊 Health check     → http://localhost:${PORT}/api/health`);
  console.log(`📱 WhatsApp OTP     → Twilio Sandbox active`);
});
