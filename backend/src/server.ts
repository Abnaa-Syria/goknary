import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

// Import routes
import categoryRoutes from './routes/categories';
import productRoutes from './routes/products';
import homeRoutes from './routes/home';
import vendorRoutes from './routes/vendors';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import authRoutes from './routes/auth';
import addressRoutes from './routes/addresses';
import wishlistRoutes from './routes/wishlist';
import compareRoutes from './routes/compare';
import vendorProfileRoutes from './routes/vendor';
import vendorProductRoutes from './routes/vendor-products';
import vendorOrderRoutes from './routes/vendor-orders';
import vendorAnalyticsRoutes from './routes/vendor-analytics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting - More lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000 // Higher limit in development
});
app.use('/api/', limiter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'GoKnary API is running',
    timestamp: new Date().toISOString()
  });
});

// Routes
import brandRoutes from './routes/brands';

app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/brands', brandRoutes);

// Vendor routes
app.use('/api/vendor', vendorProfileRoutes);
app.use('/api/vendor/products', vendorProductRoutes);
app.use('/api/vendor/orders', vendorOrderRoutes);
app.use('/api/vendor/analytics', vendorAnalyticsRoutes);

// Admin routes
import adminRoutes from './routes/admin';
import adminVendorRoutes from './routes/admin-vendors';
import adminCategoryRoutes from './routes/admin-categories';
import adminBrandRoutes from './routes/admin-brands';
import adminBannerRoutes from './routes/admin-banners';

app.use('/api/admin', adminRoutes);
app.use('/api/admin/vendors', adminVendorRoutes);
app.use('/api/admin/categories', adminCategoryRoutes);
app.use('/api/admin/brands', adminBrandRoutes);
app.use('/api/admin/banners', adminBannerRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});

