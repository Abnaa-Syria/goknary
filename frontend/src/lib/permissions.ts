/**
 * Granular CRUD Permission System — Frontend Constants
 *
 * Mirrors the backend permission matrix exactly.
 * Used for sidebar gating, button visibility, and the Permission Matrix UI.
 */

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

export const OPERATIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE'] as const;
export type Operation = (typeof OPERATIONS)[number];

export const buildPermission = (op: Operation, resource: Resource): string =>
  `${op}_${resource}`;

export const ALL_PERMISSIONS: string[] = RESOURCES.flatMap((resource) =>
  OPERATIONS.map((op) => buildPermission(op, resource))
);

/** Human-readable labels for the Permission Matrix UI */
export const RESOURCE_LABELS: Record<Resource, string> = {
  DASHBOARD: 'Dashboard',
  USERS: 'Users',
  VENDORS: 'Vendors',
  CATEGORIES: 'Categories',
  BRANDS: 'Brands',
  PRODUCTS: 'Products',
  BANNERS: 'Banners',
  ORDERS: 'Orders',
  REVIEWS: 'Reviews',
  COUPONS: 'Coupons',
  SHIPPING: 'Shipping',
  ANNOUNCEMENTS: 'Announcements',
  SETTINGS: 'Settings',
  ROLES: 'Roles',
};

export const RESOURCE_GROUPS: Record<string, Resource[]> = {
  General: ['DASHBOARD'],
  'User Management': ['USERS', 'VENDORS'],
  Catalog: ['CATEGORIES', 'BRANDS', 'PRODUCTS'],
  Content: ['BANNERS', 'REVIEWS', 'ANNOUNCEMENTS'],
  Commerce: ['ORDERS', 'COUPONS', 'SHIPPING'],
  System: ['SETTINGS', 'ROLES'],
};
