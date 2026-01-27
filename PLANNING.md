# GoKnary - E-commerce Platform Planning Document

## Phase 0: Planning & Analysis

### Reference Analysis (Noon.com Inspired)
- **Homepage Structure**: Hero banners, promotional tiles, category strips, "Top Deals", "Trending", "Recommended", "Best Sellers"
- **Navigation**: Top header with logo, search bar, account dropdown, cart icon. Mega menu for categories on desktop, drawer on mobile
- **Category Pages**: Left sidebar filters (desktop), drawer filters (mobile), product grid with sorting, pagination
- **Product Pages**: Image gallery, price with discount badges, variants selector, stock info, delivery info, seller info, reviews section, similar products
- **Cart & Checkout**: Cart page with quantity controls, checkout with address selection, shipping method, order review
- **User Account**: Profile, addresses, orders list, order details

### Sitemap

#### Customer Pages
- `/` - Homepage
- `/category/:slug` - Category listing
- `/search?q=` - Search results
- `/product/:slug` - Product details
- `/cart` - Shopping cart
- `/checkout` - Checkout flow
- `/account` - Account dashboard
- `/account/profile` - Profile settings
- `/account/addresses` - Address management
- `/account/orders` - Orders list
- `/account/orders/:id` - Order details
- `/store/:vendorSlug` - Vendor store page

#### Vendor Portal
- `/vendor` - Vendor dashboard
- `/vendor/products` - Products management
- `/vendor/orders` - Orders management
- `/vendor/analytics` - Analytics & reports
- `/vendor/settings` - Store settings

#### Admin Portal
- `/admin` - Admin dashboard
- `/admin/vendors` - Vendor management
- `/admin/products` - Product management
- `/admin/categories` - Category management
- `/admin/brands` - Brand management
- `/admin/orders` - Order management
- `/admin/banners` - Banner management
- `/admin/users` - User management

### User Journeys

#### Customer Journey
1. Browse homepage → View deals/promotions
2. Navigate categories → Filter products → View product details
3. Add to cart → Review cart → Proceed to checkout
4. Enter shipping address → Select shipping method → Place order
5. View order confirmation → Track order in account

#### Vendor Journey
1. Register → Apply for vendor account → Upload documents
2. Get approved → Access vendor dashboard
3. Add products → Set pricing/inventory → Publish products
4. Receive orders → Update order status → Manage inventory
5. View analytics → Track sales performance

#### Admin Journey
1. Login → Access admin dashboard
2. Approve/reject vendor applications
3. Manage categories, brands, products
4. Configure homepage banners and sections
5. Monitor orders and handle refunds

### Database Schema

#### Core Tables
- `users` - User accounts (id, email, password_hash, role, name, phone, created_at, updated_at)
- `vendors` - Vendor stores (id, user_id, store_name, slug, description, logo, rating, status, created_at)
- `categories` - Product categories (id, name, slug, parent_id, image, order_index)
- `brands` - Product brands (id, name, slug, logo, created_at)
- `products` - Products (id, vendor_id, category_id, brand_id, name, slug, description, sku, price, discount_price, stock, rating_avg, images, status, created_at)
- `product_images` - Product images (id, product_id, image_url, order_index)
- `orders` - Orders (id, user_id, vendor_id, status, total, subtotal, shipping_cost, address_json, created_at)
- `order_items` - Order items (id, order_id, product_id, quantity, price, discount_price)
- `order_status_history` - Order status timeline (id, order_id, status, notes, created_at)
- `cart_items` - Cart items (id, user_id/session_id, product_id, quantity, created_at)
- `reviews` - Product reviews (id, product_id, user_id, rating, title, comment, images, created_at)
- `addresses` - User addresses (id, user_id, label, full_name, phone, address_line1, address_line2, city, state, postal_code, country, is_default)
- `banners` - Homepage banners (id, title, image_url, link_url, order_index, type, status, start_date, end_date)
- `home_sections` - Homepage sections config (id, type, title, config_json, order_index, status)
- `coupons` - Coupons (id, code, discount_type, discount_value, min_purchase, max_uses, used_count, expires_at, status)
- `commissions` - Vendor commissions (id, vendor_id, order_id, commission_rate, commission_amount, status, paid_at)

### API Endpoints

#### Public Endpoints
- `GET /api/categories` - Get all categories (tree structure)
- `GET /api/home/sections` - Get homepage sections and banners
- `GET /api/products` - List products (filters: category, brand, minPrice, maxPrice, rating, sort, page, limit)
- `GET /api/products/:id` - Get product details
- `GET /api/vendors/:id` - Get vendor store details
- `GET /api/vendors/:id/products` - Get vendor's products
- `GET /api/products/:id/reviews` - Get product reviews
- `GET /api/search?q=` - Search products

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

#### Cart (Authenticated + Guest)
- `GET /api/cart` - Get cart items
- `POST /api/cart/items` - Add item to cart
- `PATCH /api/cart/items/:id` - Update cart item quantity
- `DELETE /api/cart/items/:id` - Remove cart item
- `DELETE /api/cart` - Clear cart

#### Orders (Authenticated)
- `POST /api/orders` - Place order
- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get order details
- `PATCH /api/orders/:id/cancel` - Cancel order

#### Addresses (Authenticated)
- `GET /api/addresses` - Get user addresses
- `POST /api/addresses` - Create address
- `PATCH /api/addresses/:id` - Update address
- `DELETE /api/addresses/:id` - Delete address

#### Vendor Endpoints (Vendor Role)
- `POST /api/vendor/apply` - Apply for vendor account
- `GET /api/vendor/me` - Get vendor profile
- `PATCH /api/vendor/me` - Update vendor profile
- `GET /api/vendor/products` - Get vendor products
- `POST /api/vendor/products` - Create product
- `PATCH /api/vendor/products/:id` - Update product
- `DELETE /api/vendor/products/:id` - Delete product
- `GET /api/vendor/orders` - Get vendor orders
- `PATCH /api/vendor/orders/:id/status` - Update order status
- `GET /api/vendor/analytics` - Get vendor analytics

#### Admin Endpoints (Admin Role)
- `GET /api/admin/vendors` - List vendors/applications
- `PATCH /api/admin/vendors/:id/approve` - Approve vendor
- `PATCH /api/admin/vendors/:id/reject` - Reject vendor
- `GET /api/admin/categories` - List categories
- `POST /api/admin/categories` - Create category
- `PATCH /api/admin/categories/:id` - Update category
- `DELETE /api/admin/categories/:id` - Delete category
- `GET /api/admin/brands` - List brands
- `POST /api/admin/brands` - Create brand
- `PATCH /api/admin/brands/:id` - Update brand
- `DELETE /api/admin/brands/:id` - Delete brand
- `GET /api/admin/products` - List all products
- `PATCH /api/admin/products/:id` - Update product
- `DELETE /api/admin/products/:id` - Delete product
- `GET /api/admin/orders` - List all orders
- `PATCH /api/admin/orders/:id` - Update order
- `GET /api/admin/banners` - List banners
- `POST /api/admin/banners` - Create banner
- `PATCH /api/admin/banners/:id` - Update banner
- `DELETE /api/admin/banners/:id` - Delete banner
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:id` - Update user

### Tech Stack Decisions

#### Frontend
- **Framework**: React 18 with TypeScript
- **Router**: React Router v6
- **State Management**: Redux Toolkit (better for complex e-commerce state)
- **UI Library**: Tailwind CSS (utility-first, flexible, modern)
- **HTTP Client**: Axios
- **Form Handling**: React Hook Form
- **Icons**: React Icons (Heroicons, FontAwesome)

#### Backend
- **Framework**: Express.js (faster to develop, simpler structure)
- **Database ORM**: Prisma (modern, type-safe, great migrations)
- **Auth**: JWT (jsonwebtoken) with refresh tokens
- **Validation**: Zod (type-safe, works great with TypeScript)
- **File Upload**: Multer (local storage, easy to abstract to S3 later)
- **Security**: Helmet, CORS, express-rate-limit
- **Logging**: Winston

#### Database
- **MySQL** with Prisma ORM

### Design Tokens
- **Primary Color**: #FFD700 (Golden Yellow) - similar to Noon but distinct
- **Secondary Color**: #1a237e (Dark Navy Blue)
- **Accent**: #FF6B35 (Orange for CTAs)
- **Success**: #10B981 (Green)
- **Error**: #EF4444 (Red)
- **Gray Scale**: Slate 50-900
- **Typography**: Inter font family
- **Border Radius**: 8px (cards), 12px (modals)
- **Shadows**: Subtle elevation system

### Image Strategy
- All images from `/imgs` folder will be:
  - Copied to `/frontend/public/imgs/` for public access
  - Used for product images, banners, category images
  - Mapped programmatically: product_id % image_count

### Seed Data Requirements
- 8-10 top categories with 2-3 subcategories each
- 25+ brands
- 12+ vendors (with store names, descriptions, ratings)
- 250+ products (distributed across categories/vendors)
- 75+ reviews (with ratings 1-5, some with text)
- 25+ homepage banners/tiles
- 30+ sample orders (various statuses)
- 5+ admin users
- 15+ customer users

