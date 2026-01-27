# GoKnary - E-commerce Marketplace Platform

A modern, Noon-inspired multi-vendor e-commerce platform built with React, Node.js, and MySQL.

## 🚀 Features

- **Multi-vendor marketplace** - Vendors can register, manage products, and fulfill orders
- **Customer experience** - Browse products, add to cart, checkout, and track orders
- **Admin panel** - Manage vendors, products, categories, banners, and orders
- **Modern UI** - Responsive design with Tailwind CSS, inspired by Noon.com
- **Full-stack TypeScript** - Type-safe development across frontend and backend

## 📋 Prerequisites

- Node.js 18+ and npm
- MySQL 8.0+
- Git

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd GoKnary
```

### 2. Database Setup

Create a MySQL database:

```sql
CREATE DATABASE goknary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file (copy from .env.example)
# Update DATABASE_URL with your MySQL credentials:
# DATABASE_URL="mysql://root:password@localhost:3306/goknary?schema=public"

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed the database
npm run db:seed

# Start development server
npm run dev
```

The backend will run on `http://localhost:5000`

### 4. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy images from root /imgs to /public/imgs
# (You may need to manually copy images or create a script)

# Start development server
npm start
```

The frontend will run on `http://localhost:3000`

### 5. Environment Variables

#### Backend (.env)
```env
DATABASE_URL="mysql://root:password@localhost:3306/goknary?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=5242880
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## 📁 Project Structure

```
GoKnary/
├── backend/           # Node.js + Express API
│   ├── prisma/       # Database schema and migrations
│   ├── src/
│   │   ├── routes/   # API routes
│   │   ├── controllers/ # Route controllers
│   │   ├── middleware/ # Auth, validation, etc.
│   │   ├── lib/      # Utilities (Prisma, etc.)
│   │   └── server.ts # Entry point
│   └── public/       # Uploaded files
├── frontend/         # React + TypeScript app
│   ├── public/      # Static files
│   └── src/
│       ├── components/ # React components
│       ├── pages/     # Page components
│       ├── store/     # Redux store
│       ├── lib/       # API client, utilities
│       └── App.tsx   # Main app component
└── imgs/            # Product and banner images
```

## 🎯 User Roles

1. **Customer** - Browse, purchase, manage account
2. **Vendor** - Manage products, orders, analytics
3. **Admin** - Full platform management

## 📚 API Endpoints

### Public
- `GET /api/categories` - Get all categories
- `GET /api/products` - List products with filters
- `GET /api/products/:id` - Get product details
- `GET /api/home/sections` - Get homepage sections

### Authentication
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token

### Customer
- `GET /api/cart` - Get cart
- `POST /api/cart/items` - Add to cart
- `POST /api/orders` - Place order
- `GET /api/orders` - Get user orders

### Vendor
- `POST /api/vendor/products` - Create product
- `GET /api/vendor/orders` - Get vendor orders
- `GET /api/vendor/analytics` - Get analytics

### Admin
- `GET /api/admin/vendors` - List vendors
- `POST /api/admin/categories` - Create category
- `GET /api/admin/orders` - List all orders

## 🗄️ Database Schema

Key tables:
- `users` - User accounts
- `vendors` - Vendor stores
- `categories` - Product categories (tree structure)
- `products` - Products
- `orders` - Orders
- `cart_items` - Shopping cart
- `reviews` - Product reviews
- `banners` - Homepage banners

See `backend/prisma/schema.prisma` for full schema.

## 🌱 Seed Data

The seed script creates:
- 8-10 categories with subcategories
- 25+ brands
- 12+ vendors
- 250+ products
- 75+ reviews
- 25+ banners
- 30+ sample orders

Run with: `npm run db:seed` (in backend directory)

## 🎨 Design System

- **Primary Color**: #FFD700 (Golden Yellow)
- **Secondary Color**: #1a237e (Dark Navy Blue)
- **Accent**: #FF6B35 (Orange)
- **Font**: Inter

## 📝 Development Workflow

1. Backend changes require Prisma migration: `npm run db:migrate`
2. Frontend hot-reloads automatically on save
3. Use Redux DevTools for state debugging
4. Use Prisma Studio to inspect database: `npm run db:studio`

## 🔒 Security Features

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting
- Helmet.js security headers
- CORS configuration
- Input validation with Zod

## 🚧 Roadmap

- [x] Phase 0: Planning & Analysis
- [x] Phase 1: Repo Setup + Base UI + Base API
- [ ] Phase 2: Catalog (Categories, Products, Homepage)
- [ ] Phase 3: Cart + Checkout
- [ ] Phase 4: Auth + Account
- [ ] Phase 5: Vendor Portal
- [ ] Phase 6: Admin Portal
- [ ] Phase 7: Polish & Performance

## 📄 License

ISC

## 🤝 Contributing

This is a private project. For questions or issues, please contact the development team.

