import { describe, expect, it } from '@jest/globals';
import {
  CatalogFilterKey,
  CatalogProduct,
  countActiveFilters,
  filtersFromSearchParams,
  filtersToApiParams,
  filtersToSearchParams,
  getAdminActions,
  getApiErrorMessage,
  getCatalogImageAlt,
  getInventoryState,
  getVendorActions,
} from './productCatalog';

const ADMIN: CatalogFilterKey[] = ['vendorId', 'status', 'categoryId', 'stock', 'featured'];
const VENDOR: CatalogFilterKey[] = ['status', 'categoryId', 'stock'];

const product = (overrides: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id: 'p1',
  vendorId: 'v1',
  name: 'Phone',
  nameAr: 'هاتف',
  slug: 'phone',
  sku: 'SKU-1',
  image: '/uploads/a.webp',
  imageAlt: null,
  imageAltAr: null,
  price: 100,
  discountPrice: null,
  stock: 10,
  lowStockThreshold: 5,
  hasVariants: false,
  variantCount: 0,
  status: 'ACTIVE',
  featured: false,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  ...overrides,
});

describe('URL state', () => {
  it('round-trips filters through the URL and drops defaults', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('q=iphone&status=PENDING&vendorId=v9&stock=low_stock&featured=true&sort=updated&page=3'), ADMIN);
    expect(filters).toMatchObject({ q: 'iphone', status: 'PENDING', vendorId: 'v9', stock: 'low_stock', featured: 'true', sort: 'updated', page: 3 });
    expect(filtersToSearchParams(filters).toString()).toBe('q=iphone&vendorId=v9&status=PENDING&stock=low_stock&featured=true&sort=updated&page=3');
    expect(filtersToSearchParams({ ...filters, q: '  ', vendorId: '', status: '', stock: '', featured: '', sort: 'newest', page: 1 }).toString()).toBe('');
  });

  it('ignores invalid values and filters the role cannot use', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('status=LIVE&stock=lots&sort=ranking&page=-2&vendorId=v9&featured=true'), VENDOR);
    expect(filters).toMatchObject({ status: '', stock: '', sort: 'newest', page: 1, vendorId: '', featured: '' });
  });

  it('sends only active filters to the API with the page size', () => {
    const filters = filtersFromSearchParams(new URLSearchParams('q= cable &categoryId=c1'), VENDOR);
    expect(filtersToApiParams(filters, 20)).toEqual({ page: 1, limit: 20, sort: 'newest', q: 'cable', categoryId: 'c1' });
    expect(countActiveFilters(filters)).toBe(2);
  });
});

describe('inventory state', () => {
  it('uses the product threshold for low stock', () => {
    expect(getInventoryState({ stock: 0, lowStockThreshold: 5 })).toBe('out_of_stock');
    expect(getInventoryState({ stock: -1, lowStockThreshold: 5 })).toBe('out_of_stock');
    expect(getInventoryState({ stock: 5, lowStockThreshold: 5 })).toBe('low_stock');
    expect(getInventoryState({ stock: 6, lowStockThreshold: 5 })).toBe('in_stock');
    expect(getInventoryState({ stock: 1, lowStockThreshold: 0 })).toBe('in_stock');
  });
});

describe('admin actions', () => {
  const full = { canUpdate: true, canDelete: true };

  it('pending products lead with approve and reject and have no visibility toggle', () => {
    const actions = getAdminActions(product({ status: 'PENDING' }), full);
    expect(actions.slice(0, 2)).toEqual(['approve', 'reject']);
    expect(actions).not.toContain('hide');
    expect(actions).not.toContain('republish');
  });

  it('live products can be hidden, hidden products republished', () => {
    expect(getAdminActions(product({ status: 'APPROVED' }), full)).toContain('hide');
    expect(getAdminActions(product({ status: 'ACTIVE' }), full)).toContain('hide');
    const inactive = getAdminActions(product({ status: 'INACTIVE' }), full);
    expect(inactive).toContain('republish');
    expect(inactive).not.toContain('hide');
  });

  it('drafts and rejected products get no fake publish control', () => {
    for (const status of ['DRAFT', 'REJECTED'] as const) {
      const actions = getAdminActions(product({ status }), full);
      expect(actions).not.toEqual(expect.arrayContaining(['approve']));
      expect(actions).not.toContain('hide');
      expect(actions).not.toContain('republish');
    }
  });

  it('preview is available for every status', () => {
    for (const status of ['DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'APPROVED', 'INACTIVE'] as const) {
      expect(getAdminActions(product({ status }), { canUpdate: false, canDelete: false })).toEqual(['preview']);
    }
  });

  it('featured toggles explicitly and respects permissions', () => {
    expect(getAdminActions(product({ featured: false }), full)).toContain('feature');
    expect(getAdminActions(product({ featured: true }), full)).toContain('unfeature');
    expect(getAdminActions(product(), { canUpdate: true, canDelete: false })).not.toContain('delete');
  });
});

describe('vendor actions', () => {
  it('follows the vendor lifecycle without admin actions', () => {
    expect(getVendorActions(product({ status: 'DRAFT' }))).toEqual(['submit', 'preview', 'edit', 'delete']);
    expect(getVendorActions(product({ status: 'PENDING' }))).toEqual(['preview', 'edit', 'returnToDraft', 'delete']);
    expect(getVendorActions(product({ status: 'REJECTED' }))).toEqual(['resubmit', 'preview', 'edit', 'delete']);
    expect(getVendorActions(product({ status: 'APPROVED' }))).toEqual(['edit', 'viewInStore', 'hide', 'delete']);
    expect(getVendorActions(product({ status: 'ACTIVE' }))).not.toContain('preview');
    expect(getVendorActions(product({ status: 'INACTIVE' }))).toEqual(['sendForReview', 'preview', 'edit', 'delete']);
    for (const status of ['DRAFT', 'PENDING', 'REJECTED', 'ACTIVE', 'APPROVED', 'INACTIVE'] as const) {
      const actions = getVendorActions(product({ status }));
      expect(actions).not.toContain('approve');
      expect(actions).not.toContain('feature');
      expect(actions).not.toContain('republish');
    }
  });
});

describe('display helpers', () => {
  it('uses localized image alt, then the localized name', () => {
    expect(getCatalogImageAlt(product({ imageAlt: 'Black phone', imageAltAr: 'هاتف أسود' }), true)).toBe('هاتف أسود');
    expect(getCatalogImageAlt(product({ imageAlt: 'Black phone' }), true)).toBe('هاتف');
    expect(getCatalogImageAlt(product({ nameAr: null }), true)).toBe('Phone');
  });

  it('shows the Arabic backend error in Arabic', () => {
    const error = { response: { data: { error: 'Cannot delete', errorAr: 'لا يمكن الحذف' } } };
    expect(getApiErrorMessage(error, true, 'x')).toBe('لا يمكن الحذف');
    expect(getApiErrorMessage(error, false, 'x')).toBe('Cannot delete');
    expect(getApiErrorMessage(new Error('network'), true, 'fallback')).toBe('fallback');
  });
});
