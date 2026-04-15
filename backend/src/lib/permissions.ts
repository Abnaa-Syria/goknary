/**
 * Granular CRUD Permission System
 * 
 * Every resource has 4 operations: CREATE, READ, UPDATE, DELETE.
 * Super Admins (role === 'ADMIN') bypass all checks.
 * Staff users are gated by their CustomRole's permissions array.
 */

// ─── Resources ───────────────────────────────────────────────────────────────

export const RESOURCES = [
  'DASHBOARD',
  'USERS',
  'VENDORS',
  'CATEGORIES',
  'BRANDS',
  'PRODUCTS',
  'BANNERS',
  'ORDERS',
  'REVIEWS',
  'COUPONS',
  'SHIPPING',
  'ANNOUNCEMENTS',
  'SETTINGS',
  'ROLES',
] as const;

export type Resource = (typeof RESOURCES)[number];

// ─── Operations ──────────────────────────────────────────────────────────────

export const OPERATIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'] as const;
export type Operation = (typeof OPERATIONS)[number];

// ─── Permission Key Builder ──────────────────────────────────────────────────

export const buildPermission = (op: Operation, resource: Resource): string =>
  `${op}_${resource}`;

// ─── Full Permission Matrix ──────────────────────────────────────────────────

export const ALL_PERMISSIONS: string[] = RESOURCES.flatMap((resource) =>
  OPERATIONS.map((op) => buildPermission(op, resource))
);

// ─── Convenience Shortcuts (for route middleware) ────────────────────────────

// Dashboard
export const READ_DASHBOARD = 'READ_DASHBOARD';

// Users
export const CREATE_USERS = 'CREATE_USERS';
export const READ_USERS = 'READ_USERS';
export const UPDATE_USERS = 'UPDATE_USERS';
export const DELETE_USERS = 'DELETE_USERS';

// Vendors
export const CREATE_VENDORS = 'CREATE_VENDORS';
export const READ_VENDORS = 'READ_VENDORS';
export const UPDATE_VENDORS = 'UPDATE_VENDORS';
export const DELETE_VENDORS = 'DELETE_VENDORS';

// Categories
export const CREATE_CATEGORIES = 'CREATE_CATEGORIES';
export const READ_CATEGORIES = 'READ_CATEGORIES';
export const UPDATE_CATEGORIES = 'UPDATE_CATEGORIES';
export const DELETE_CATEGORIES = 'DELETE_CATEGORIES';

// Brands
export const CREATE_BRANDS = 'CREATE_BRANDS';
export const READ_BRANDS = 'READ_BRANDS';
export const UPDATE_BRANDS = 'UPDATE_BRANDS';
export const DELETE_BRANDS = 'DELETE_BRANDS';

// Products
export const CREATE_PRODUCTS = 'CREATE_PRODUCTS';
export const READ_PRODUCTS = 'READ_PRODUCTS';
export const UPDATE_PRODUCTS = 'UPDATE_PRODUCTS';
export const DELETE_PRODUCTS = 'DELETE_PRODUCTS';

// Banners
export const CREATE_BANNERS = 'CREATE_BANNERS';
export const READ_BANNERS = 'READ_BANNERS';
export const UPDATE_BANNERS = 'UPDATE_BANNERS';
export const DELETE_BANNERS = 'DELETE_BANNERS';

// Orders
export const CREATE_ORDERS = 'CREATE_ORDERS';
export const READ_ORDERS = 'READ_ORDERS';
export const UPDATE_ORDERS = 'UPDATE_ORDERS';
export const DELETE_ORDERS = 'DELETE_ORDERS';

// Reviews
export const CREATE_REVIEWS = 'CREATE_REVIEWS';
export const READ_REVIEWS = 'READ_REVIEWS';
export const UPDATE_REVIEWS = 'UPDATE_REVIEWS';
export const DELETE_REVIEWS = 'DELETE_REVIEWS';

// Coupons
export const CREATE_COUPONS = 'CREATE_COUPONS';
export const READ_COUPONS = 'READ_COUPONS';
export const UPDATE_COUPONS = 'UPDATE_COUPONS';
export const DELETE_COUPONS = 'DELETE_COUPONS';

// Shipping
export const CREATE_SHIPPING = 'CREATE_SHIPPING';
export const READ_SHIPPING = 'READ_SHIPPING';
export const UPDATE_SHIPPING = 'UPDATE_SHIPPING';
export const DELETE_SHIPPING = 'DELETE_SHIPPING';

// Announcements
export const CREATE_ANNOUNCEMENTS = 'CREATE_ANNOUNCEMENTS';
export const READ_ANNOUNCEMENTS = 'READ_ANNOUNCEMENTS';
export const UPDATE_ANNOUNCEMENTS = 'UPDATE_ANNOUNCEMENTS';
export const DELETE_ANNOUNCEMENTS = 'DELETE_ANNOUNCEMENTS';

// Settings
export const CREATE_SETTINGS = 'CREATE_SETTINGS';
export const READ_SETTINGS = 'READ_SETTINGS';
export const UPDATE_SETTINGS = 'UPDATE_SETTINGS';
export const DELETE_SETTINGS = 'DELETE_SETTINGS';

// Roles (only Super Admin)
export const CREATE_ROLES = 'CREATE_ROLES';
export const READ_ROLES = 'READ_ROLES';
export const UPDATE_ROLES = 'UPDATE_ROLES';
export const DELETE_ROLES = 'DELETE_ROLES';
