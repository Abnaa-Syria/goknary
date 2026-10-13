import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATALOG_DEFAULT_LIMIT,
  CATALOG_MAX_LIMIT,
  buildCatalogWhere,
  catalogOrderBy,
  catalogPagination,
  formatCatalogProduct,
  parseCatalogQuery,
} from './product-catalog';
import { ValidationError } from './errors';

const ADMIN = { allowVendor: true, allowFeatured: true };
const VENDOR = { allowVendor: false, allowFeatured: false };

describe('parseCatalogQuery', () => {
  it('uses backward-compatible defaults', () => {
    const query = parseCatalogQuery({}, ADMIN);
    assert.equal(query.page, 1);
    assert.equal(query.limit, CATALOG_DEFAULT_LIMIT);
    assert.equal(query.stock, 'all');
    assert.equal(query.sort, 'newest');
    assert.equal(query.status, undefined);
    assert.equal(query.featured, undefined);
    assert.equal(query.q, undefined);
    assert.equal(query.includeSummary, false);
  });

  it('caps the limit and falls back on malformed page/limit', () => {
    assert.equal(parseCatalogQuery({ limit: '100000' }, ADMIN).limit, CATALOG_MAX_LIMIT);
    assert.equal(parseCatalogQuery({ limit: '-5', page: 'abc' }, ADMIN).limit, CATALOG_DEFAULT_LIMIT);
    assert.equal(parseCatalogQuery({ page: '0' }, ADMIN).page, 1);
    assert.equal(parseCatalogQuery({ page: '7' }, ADMIN).page, 7);
  });

  it('accepts real statuses only, case-insensitively, and treats "all" as no filter', () => {
    assert.equal(parseCatalogQuery({ status: 'pending' }, ADMIN).status, 'PENDING');
    assert.equal(parseCatalogQuery({ status: 'all' }, ADMIN).status, undefined);
    assert.throws(() => parseCatalogQuery({ status: 'LIVE' }, ADMIN), ValidationError);
    assert.throws(() => parseCatalogQuery({ status: 'HACKED' }, VENDOR), ValidationError);
  });

  it('validates stock, sort and featured values', () => {
    assert.equal(parseCatalogQuery({ stock: 'low_stock' }, ADMIN).stock, 'low_stock');
    assert.throws(() => parseCatalogQuery({ stock: 'some' }, ADMIN), ValidationError);
    assert.equal(parseCatalogQuery({ sort: 'updated' }, ADMIN).sort, 'updated');
    assert.throws(() => parseCatalogQuery({ sort: 'ranking' }, ADMIN), ValidationError);
    assert.equal(parseCatalogQuery({ featured: 'true' }, ADMIN).featured, true);
    assert.equal(parseCatalogQuery({ featured: 'false' }, ADMIN).featured, false);
    assert.throws(() => parseCatalogQuery({ featured: 'yes' }, ADMIN), ValidationError);
  });

  it('ignores vendor and featured filters for vendors', () => {
    const query = parseCatalogQuery({ vendorId: 'other-vendor', featured: 'true' }, VENDOR);
    assert.equal(query.vendorId, undefined);
    assert.equal(query.featured, undefined);
  });

  it('rejects malformed ids and trims/limits search text', () => {
    assert.throws(() => parseCatalogQuery({ vendorId: "x' OR 1=1" }, ADMIN), ValidationError);
    assert.throws(() => parseCatalogQuery({ categoryId: 'a b' }, ADMIN), ValidationError);
    assert.equal(parseCatalogQuery({ q: '   iphone    15  ' }, ADMIN).q, 'iphone 15');
    assert.equal(parseCatalogQuery({ q: 'x'.repeat(500) }, ADMIN).q?.length, 100);
    assert.equal(parseCatalogQuery({ q: '   ' }, ADMIN).q, undefined);
  });

  it('uses the first value of repeated params', () => {
    assert.equal(parseCatalogQuery({ status: ['DRAFT', 'PENDING'] }, ADMIN).status, 'DRAFT');
  });
});

describe('buildCatalogWhere', () => {
  it('always keeps the caller scope, so a vendor cannot widen it', async () => {
    const query = parseCatalogQuery({ vendorId: 'someone-else', q: 'phone' }, VENDOR);
    const where = await buildCatalogWhere({ vendorId: 'mine' }, query, VENDOR);
    const and = where.AND as any[];
    assert.deepEqual(and[0], { vendorId: 'mine' });
    assert.ok(!and.some((clause) => clause.vendorId === 'someone-else'));
  });

  it('combines status, featured, stock and search in the database query', async () => {
    const query = parseCatalogQuery({ status: 'ACTIVE', featured: 'false', stock: 'out_of_stock', q: 'SKU-1', vendorId: 'v1' }, ADMIN);
    const and = (await buildCatalogWhere({}, query, ADMIN)).AND as any[];
    assert.ok(and.some((c) => c.vendorId === 'v1'));
    assert.ok(and.some((c) => c.status === 'ACTIVE'));
    assert.ok(and.some((c) => c.featured === false));
    assert.ok(and.some((c) => c.stock?.lte === 0));
    const search = and.find((c) => c.OR)?.OR as any[];
    const fields = search.map((c) => Object.keys(c)[0]);
    for (const field of ['id', 'name', 'nameAr', 'sku', 'slug', 'variants', 'vendor']) assert.ok(fields.includes(field), field);
  });

  it('low stock compares against each product\'s own threshold column', async () => {
    const query = parseCatalogQuery({ stock: 'low_stock' }, VENDOR);
    const and = (await buildCatalogWhere({ vendorId: 'mine' }, query, VENDOR)).AND as any[];
    const stock = and.find((c) => c.stock)?.stock;
    assert.equal(stock.gt, 0);
    assert.equal(stock.lte?.name, 'lowStockThreshold');
  });

  it('does not search the store name for vendors', async () => {
    const query = parseCatalogQuery({ q: 'phone' }, VENDOR);
    const and = (await buildCatalogWhere({ vendorId: 'mine' }, query, VENDOR)).AND as any[];
    const search = and.find((c) => c.OR)?.OR as any[];
    assert.ok(!search.some((c) => 'vendor' in c));
  });
});

describe('catalog helpers', () => {
  it('orders deterministically with an id tie-breaker', () => {
    assert.deepEqual(catalogOrderBy('newest'), [{ createdAt: 'desc' }, { id: 'desc' }]);
    assert.deepEqual(catalogOrderBy('oldest'), [{ createdAt: 'asc' }, { id: 'asc' }]);
    assert.deepEqual(catalogOrderBy('updated'), [{ updatedAt: 'desc' }, { id: 'desc' }]);
  });

  it('builds pagination metadata from the filtered total', () => {
    const query = parseCatalogQuery({ page: '2', limit: '20' }, ADMIN);
    assert.deepEqual(catalogPagination(query, 45), { page: 2, limit: 20, total: 45, totalPages: 3 });
    assert.equal(catalogPagination(query, 0).totalPages, 1);
  });

  const row = (images: string, imageMetadata: string | null, variants: number) => ({
    id: 'p1', images, imageMetadata, _count: { variants },
  }) as any;

  it('exposes the main image with its alt text and the variant row count', () => {
    const product = formatCatalogProduct(row(
      JSON.stringify(['/uploads/a.webp', '/uploads/b.jpg']),
      JSON.stringify([{ url: '/uploads/a.webp', altEn: 'Black phone', altAr: 'هاتف أسود' }]),
      4,
    ));
    assert.equal(product.image, '/uploads/a.webp');
    assert.equal(product.imageAlt, 'Black phone');
    assert.equal(product.imageAltAr, 'هاتف أسود');
    assert.equal(product.imageCount, 2);
    assert.equal(product.variantCount, 4);
    assert.ok(!('images' in product) && !('_count' in product));
  });

  it('tolerates legacy and malformed image JSON', () => {
    const legacy = formatCatalogProduct(row(JSON.stringify(['/uploads/old.png']), null, 0));
    assert.equal(legacy.image, '/uploads/old.png');
    assert.equal(legacy.imageAlt, null);
    assert.equal(legacy.variantCount, 0);
    const broken = formatCatalogProduct(row('not json', '{oops', 0));
    assert.equal(broken.image, null);
    assert.equal(broken.imageCount, 0);
  });
});
