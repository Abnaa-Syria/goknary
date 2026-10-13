import React from 'react';
import { act } from 'react-dom/test-utils';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { afterEach, beforeAll, describe, expect, it } from '@jest/globals';
import i18n from '../../i18n';
import ProductPreview from './ProductPreview';
import ProductPreviewStatusBanner from './ProductPreviewStatusBanner';
import { getProductOffer } from '../../lib/productOffer';
import type { PreviewProduct } from '../../hooks/useProductPreview';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const attr = (name: string, value: string, nameAr?: string, valueAr?: string) => ({ name, value, nameAr, valueAr });

const variants = [
  { id: 'v-black', name: '128 GB / Black', price: 1000, discountPrice: 900, stock: 0, status: true, isDefault: true,
    image: '/uploads/black.webp', imageAlt: 'Black phone front', imageAltAr: 'هاتف أسود', createdAt: '2026-01-01T00:00:01Z',
    attributes: [attr('Storage', '128 GB', 'السعة', '128 جيجابايت'), attr('Color', 'Black', 'اللون', 'أسود')] },
  { id: 'v-silver', name: '256 GB / Silver', price: 1300, discountPrice: null, stock: 7, status: true, isDefault: false,
    image: '/uploads/silver.webp', imageAlt: 'Silver phone front', createdAt: '2026-01-01T00:00:02Z',
    attributes: [attr('Storage', '256 GB'), attr('Color', 'Silver')] },
  { id: 'v-hidden', name: '512 GB / Gold', price: 9999, discountPrice: null, stock: 4, status: false, isDefault: false,
    createdAt: '2026-01-01T00:00:03Z', attributes: [attr('Storage', '512 GB'), attr('Color', 'Gold')] },
];

const baseProduct = (patch: Partial<PreviewProduct> = {}): PreviewProduct => ({
  id: 'p-1',
  name: 'QA Phone',
  nameAr: 'هاتف تجريبي',
  slug: 'qa-phone',
  sku: 'QA-1',
  description: 'English description',
  descriptionAr: 'وصف عربي',
  price: 500,
  discountPrice: null,
  stock: 3,
  images: ['/uploads/main.webp'],
  imageMetadata: JSON.stringify([{ url: '/uploads/main.webp', altEn: 'Phone on a desk', altAr: 'هاتف على مكتب' }]),
  status: 'DRAFT',
  hasVariants: true,
  rating: 0,
  reviewCount: 0,
  createdAt: '2026-01-01T00:00:00Z',
  vendor: { id: 'vendor-1', storeName: 'TechStore', storeNameAr: 'تك ستور', slug: 'techstore', rating: 0 },
  category: { id: 'c1', name: 'Phones', nameAr: 'هواتف', slug: 'phones' },
  brand: { id: 'b1', name: 'Acme', nameAr: 'أكمي', slug: 'acme' },
  variants,
  ...patch,
} as any);

const store = configureStore({ reducer: { settings: () => ({ freeShippingThreshold: 1000 }) } });

let container: HTMLDivElement;
let root: Root;

const render = (ui: React.ReactElement) => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // Plain react-dom root (no Testing Library here); act is what flushes the selection effect.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  act(() => {
    root.render(
      <Provider store={store}>
        <MemoryRouter>{ui}</MemoryRouter>
      </Provider>,
    );
  });
};

const text = () => container.textContent ?? '';
const buttons = () => Array.from(container.querySelectorAll('button'));
const pressed = () => buttons().filter((b) => b.getAttribute('aria-pressed') === 'true' && !b.querySelector('img')).map((b) => b.textContent);

beforeAll(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  act(() => root.unmount());
  container.remove();
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

describe('ProductPreview (shared customer rendering, commerce disabled)', () => {
  it('opens on the default variant even when it is out of stock and shows its own price, stock and image', () => {
    render(<ProductPreview product={baseProduct()} />);
    expect(pressed()).toEqual(['128 GB (Out of stock)', 'Black (Out of stock)']);
    expect(text()).toContain('900');
    expect(text()).toContain('1,000');
    expect(text()).not.toMatch(/from/i);
    const mainImage = container.querySelector('img');
    expect(mainImage?.getAttribute('src')).toContain('black.webp');
    expect(mainImage?.getAttribute('alt')).toBe('Black phone front');
  });

  it('switches price, stock and image with the selected variant and hides inactive variants', () => {
    render(<ProductPreview product={baseProduct()} />);
    expect(text()).not.toContain('512 GB');
    const silver = buttons().find((b) => b.textContent?.includes('Silver'));
    act(() => silver!.click());
    expect(text()).toContain('1,300');
    expect(text()).toContain('7');
    expect(container.querySelector('img')?.getAttribute('src')).toContain('silver.webp');
  });

  it('replaces every commerce action with an explanation', () => {
    render(<ProductPreview product={baseProduct()} />);
    expect(text()).toContain('Purchasing is disabled in preview mode');
    const labels = buttons().map((b) => `${b.textContent} ${b.getAttribute('aria-label') ?? ''}`.toLowerCase());
    for (const forbidden of ['add to cart', 'buy now', 'wishlist', 'compare', 'review']) {
      expect(labels.some((l) => l.includes(forbidden))).toBe(false);
    }
    expect(container.querySelector('input[type="number"]')).toBeNull();
  });

  it('shows category, brand and description without internal IDs or links to public pages', () => {
    render(<ProductPreview product={baseProduct()} />);
    expect(text()).toContain('Phones');
    expect(text()).toContain('Acme');
    expect(text()).toContain('English description');
    expect(text()).not.toContain('p-1');
    expect(text()).not.toContain('vendor-1');
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    expect(hrefs.filter((h) => h && /^\/(product|category|brand|vendor|store)/.test(h))).toEqual([]);
  });

  it('marks the page noindex while mounted', () => {
    render(<ProductPreview product={baseProduct()} />);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    act(() => root.unmount());
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
    root = createRoot(container);
  });

  it('renders simple and malformed products without crashing', () => {
    render(<ProductPreview product={baseProduct({ variants: [], hasVariants: false, images: [], imageMetadata: '{bad json' } as any)} />);
    expect(text()).toContain('QA Phone');
    expect(text()).toContain('500');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('QA Phone');
  });

  it('uses Arabic names, alt text and description in Arabic', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    render(<ProductPreview product={baseProduct()} />);
    expect(text()).toContain('هاتف تجريبي');
    expect(text()).toContain('وصف عربي');
    expect(text()).toContain('إجراءات الشراء معطلة في وضع المعاينة');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('هاتف أسود');
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
});

describe('ProductPreviewStatusBanner', () => {
  it('shows the rejection reason prominently for rejected products', () => {
    render(<ProductPreviewStatusBanner status="REJECTED" rejectionReason="Images are blurry" />);
    expect(text()).toContain('Preview mode — this product is not currently visible to customers.');
    expect(text()).toContain('Rejection reason');
    expect(text()).toContain('Images are blurry');
  });

  it.each([
    ['DRAFT', 'has not been submitted for review yet'],
    ['PENDING', "customers won't see it until it is approved"],
    ['INACTIVE', 'It has not been deleted'],
  ])('explains the %s status without moderation actions', (status, copy) => {
    render(<ProductPreviewStatusBanner status={status} />);
    expect(text()).toContain(copy);
    expect(text()).not.toContain('Rejection reason');
    expect(text().toLowerCase()).not.toContain('approve ');
    expect(buttons()).toHaveLength(0);
  });

  it('uses the requested Arabic copy', async () => {
    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    render(<ProductPreviewStatusBanner status="PENDING" />);
    expect(text()).toContain('بانتظار المراجعة');
    expect(text()).toContain('يمكنك معاينة المنتج، لكنه لن يظهر للعملاء حتى تتم الموافقة عليه.');
    expect(text()).toContain('وضع المعاينة — هذا المنتج غير ظاهر للعملاء حالياً.');
    await act(async () => {
      await i18n.changeLanguage('en');
    });
  });
});

describe('getProductOffer', () => {
  it('uses only the selected variant for variant products', () => {
    const offer = getProductOffer(baseProduct() as any, variants[1] as any);
    expect(offer).toMatchObject({ usesVariants: true, price: 1300, discountPrice: null, stock: 7, displayPrice: 1300, originalPrice: null });
  });

  it('ignores inactive variants and falls back to product fields for simple products', () => {
    const offer = getProductOffer({ price: 500, discountPrice: 450, stock: 2, variants: [variants[2]] as any }, null);
    expect(offer).toMatchObject({ usesVariants: false, displayPrice: 450, originalPrice: 500, stock: 2 });
  });
});
