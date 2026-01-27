# GoKnary Setup Guide

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- MySQL 8.0+
- Git

### Step 1: Database Setup

```sql
CREATE DATABASE goknary CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 2: Backend Setup

```bash
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env and update DATABASE_URL with your MySQL credentials

# Generate Prisma Client
npm run db:generate

# Run migrations
npm run db:migrate

# Seed database
npm run db:seed

# Start server
npm run dev
```

Backend runs on `http://localhost:5000`

### Step 3: Frontend Setup

```bash
cd frontend
npm install

# Create .env file (optional)
echo "REACT_APP_API_URL=http://localhost:5000/api" > .env

# Start development server
npm start
```

Frontend runs on `http://localhost:3000`

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="mysql://root:password@localhost:3306/goknary?schema=public"
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
```

## Default Login Credentials (from seed)

After running `npm run db:seed`, you can use:

- **Admin**: admin@goknary.com / password123
- **Vendor**: vendor1@goknary.com / password123 (and vendor2-12)
- **Customer**: customer1@goknary.com / password123 (and customer2-15)

## Development Commands

### Backend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with sample data
- `npm run db:studio` - Open Prisma Studio (database GUI)

### Frontend
- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests

## Project Status

✅ **Phase 0**: Planning & Analysis - Complete
✅ **Phase 1**: Repo Setup + Base UI + Base API - Complete
✅ **Phase 2**: Catalog (Categories, Products, Homepage) - Complete
⏳ **Phase 3**: Cart + Checkout - Pending
⏳ **Phase 4**: Auth + Account - Pending
⏳ **Phase 5**: Vendor Portal - Pending
⏳ **Phase 6**: Admin Portal - Pending
⏳ **Phase 7**: Polish & Performance - Pending

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check DATABASE_URL in .env matches your MySQL credentials
- Ensure database `goknary` exists

### Port Already in Use
- Backend: Change PORT in .env
- Frontend: React will prompt to use a different port

### Prisma Errors
- Run `npm run db:generate` after schema changes
- Run `npm run db:migrate` to apply migrations

### Images Not Loading
- Ensure images are copied to `frontend/public/imgs/`
- Check image paths in product data match actual filenames

## Next Steps

1. Complete Phase 3: Cart + Checkout functionality
2. Complete Phase 4: Authentication and user accounts
3. Complete Phase 5: Vendor portal
4. Complete Phase 6: Admin portal
5. Complete Phase 7: Polish and performance optimization

