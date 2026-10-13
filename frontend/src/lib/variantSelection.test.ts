import { describe, expect, it } from '@jest/globals';
import {
  CustomerVariant,
  buildVariantMatrix,
  getActiveVariants,
  getLocalizedOptionName,
  getLocalizedOptionValue,
  getOptionState,
  isPurchasableVariant,
  normalizeOptionText,
  pickInitialVariant,
  resolveOptionChoice,
} from './variantSelection';
import { getLocalizedVariantAttributes, getLocalizedVariantName, parseVariantSnapshot } from './variants';

type Attr = [string, string, string?, string?];
let seq = 0;
const variant = (name: string, attrs: Attr[], patch: Partial<CustomerVariant> = {}): CustomerVariant => {
  seq += 1;
  return {
    id: `v${seq}`,
    name,
    price: 100,
    discountPrice: null,
    stock: 5,
    status: true,
    isDefault: false,
    createdAt: new Date(2026, 0, 1, 0, 0, seq).toISOString(),
    attributes: attrs.map(([n, v, nAr, vAr]) => ({ name: n, value: v, nameAr: nAr, valueAr: vAr })),
    ...patch,
  };
};
const groupKeys = (vs: CustomerVariant[]) => {
  const m = buildVariantMatrix(vs);
  return m.groups.map((g) => `${g.key}:${g.values.map((v) => v.key).join(',')}`);
};

describe('A. phone (Storage × Color) with a missing combination', () => {
  const v128Black = variant('128 GB / Black', [['Storage', '128 GB', 'السعة', '128 جيجابايت'], ['Color', 'Black', 'اللون', 'أسود']], { isDefault: true });
  const v256Black = variant('256 GB / Black', [['Storage', '256 GB'], ['Color', 'Black']], { price: 1200, discountPrice: 1100 });
  const v256Silver = variant('256 GB / Silver', [['Storage', '256 GB'], ['Color', 'Silver', '', 'فضي']], { stock: 0, image: '/uploads/silver.webp' });
  const all = [v128Black, v256Black, v256Silver];
  const matrix = buildVariantMatrix(all);

  it('builds attribute groups from real data only', () => {
    expect(matrix.mode).toBe('attributes');
    expect(groupKeys(all)).toEqual(['storage:128 gb,256 gb', 'color:black,silver']);
  });
  it('128 + Silver is not invented: Silver is unavailable with 128 selected', () => {
    expect(getOptionState(matrix, all, v128Black, 'color', 'silver')).toBe('unavailableWithSelection');
    expect(getOptionState(matrix, all, v128Black, 'storage', '256 gb')).toBe('available');
  });
  it('clicking Silver from 128/Black selects the real 256/Silver', () => {
    expect(resolveOptionChoice(matrix, all, v128Black, 'color', 'silver')).toBe(v256Silver);
  });
  it('clicking 256 from 128/Black keeps Black', () => {
    expect(resolveOptionChoice(matrix, all, v128Black, 'storage', '256 gb')).toBe(v256Black);
  });
  it('active out-of-stock option is visible and reported as out of stock', () => {
    expect(getOptionState(matrix, all, v256Black, 'color', 'silver')).toBe('outOfStock');
    expect(isPurchasableVariant(v256Silver)).toBe(false);
    expect(isPurchasableVariant(v256Black)).toBe(true);
  });
  it('localized group and value labels fall back to English', () => {
    const [storage, color] = matrix.groups;
    expect(getLocalizedOptionName(storage, true)).toBe('السعة');
    expect(getLocalizedOptionName(storage, false)).toBe('Storage');
    expect(getLocalizedOptionValue(color.values[0], true)).toBe('أسود');
    expect(getLocalizedOptionValue(storage.values[1], true)).toBe('256 GB');
    expect(getLocalizedOptionValue(color.values[1], false)).toBe('Silver');
  });
});

describe('B–E. other categories use the same generic selector', () => {
  it('appliance: Capacity × Material', () => {
    const vs = [
      variant('1 L Glass', [['Capacity', '1 L'], ['Material', 'Glass']], { isDefault: true }),
      variant('1 L Steel', [['Capacity', '1 L'], ['Material', 'Steel']]),
      variant('2 L Glass', [['Capacity', '2 L'], ['Material', 'Glass']]),
      variant('2 L Steel', [['Capacity', '2 L'], ['Material', 'Steel']]),
    ];
    expect(groupKeys(vs)).toEqual(['capacity:1 l,2 l', 'material:glass,steel']);
    const m = buildVariantMatrix(vs);
    expect(resolveOptionChoice(m, vs, vs[0], 'material', 'steel')).toBe(vs[1]);
  });
  it('food: Pack × Flavor (no technical assumptions)', () => {
    const vs = [
      variant('6 Vanilla', [['Pack', '6 Pieces', 'العبوة', '6 قطع'], ['Flavor', 'Vanilla', 'النكهة', 'فانيليا']], { isDefault: true }),
      variant('12 Chocolate', [['Pack', '12 Pieces', 'العبوة', '12 قطعة'], ['Flavor', 'Chocolate', 'النكهة', 'شوكولاتة']]),
    ];
    const m = buildVariantMatrix(vs);
    expect(m.mode).toBe('attributes');
    expect(getOptionState(m, vs, vs[0], 'flavor', 'chocolate')).toBe('unavailableWithSelection');
    expect(resolveOptionChoice(m, vs, vs[0], 'flavor', 'chocolate')).toBe(vs[1]);
  });
  it('cable: three dimensions (Length × Connector × Color) and earlier attributes win ties', () => {
    const vs = [
      variant('a', [['Length', '1m'], ['Connector', 'USB-C'], ['Color', 'White']], { isDefault: true }),
      variant('b', [['Length', '2m'], ['Connector', 'USB-C'], ['Color', 'Black']]),
      variant('c', [['Length', '1m'], ['Connector', 'Lightning'], ['Color', 'Black']]),
      variant('d', [['Length', '3m'], ['Connector', 'Lightning'], ['Color', 'White']]),
    ];
    const m = buildVariantMatrix(vs);
    expect(m.groups.map((g) => g.key)).toEqual(['length', 'connector', 'color']);
    // From a (1m/USB-C/White) choose Black: b keeps USB-C, c keeps 1m → Length is earlier, so c.
    expect(resolveOptionChoice(m, vs, vs[0], 'color', 'black')).toBe(vs[2]);
    expect(getOptionState(m, vs, vs[0], 'length', '3m')).toBe('unavailableWithSelection');
  });
  it('fashion: Size × Color is not special-cased', () => {
    const vs = [
      variant('M Black', [['Size', 'M'], ['Color', 'Black']], { isDefault: true }),
      variant('L White', [['Size', 'L'], ['Color', 'White']]),
    ];
    expect(groupKeys(vs)).toEqual(['size:m,l', 'color:black,white']);
  });
  it('single attribute (perfume volume)', () => {
    const vs = [variant('50 ml', [['Volume', '50 ml']]), variant('100 ml', [['Volume', '100 ml']], { isDefault: true })];
    const m = buildVariantMatrix(vs);
    expect(groupKeys(vs)).toEqual(['volume:50 ml,100 ml']);
    expect(getOptionState(m, vs, vs[1], 'volume', '50 ml')).toBe('available');
  });
  it('normalization: case, spaces and whitespace do not split groups/values', () => {
    const vs = [
      variant('a', [['Pack  Size', '6 pieces']]),
      variant('b', [[' pack size ', '12 Pieces']]),
      variant('c', [['PACK SIZE', '6 Pieces ']], { stock: 0 }),
    ];
    // a and c are the same combination after normalization → not a clean matrix → list fallback.
    expect(buildVariantMatrix(vs).mode).toBe('list');
    expect(normalizeOptionText('  Pack   SIZE ')).toBe('pack size');
    expect(groupKeys(vs.slice(0, 2))).toEqual(['pack size:6 pieces,12 pieces']);
  });
  it('Arabic-only attribute names group by the Arabic name', () => {
    const vs = [variant('a', [['', '1', 'الحجم', 'صغير']]), variant('b', [['', '2', 'الحجم', 'كبير']])];
    const m = buildVariantMatrix(vs);
    expect(m.mode).toBe('attributes');
    expect(m.groups[0].key).toBe('الحجم');
  });
});

describe('F. irregular products fall back to a variant list', () => {
  it('missing attributes', () => {
    const vs = [variant('Standard Pack', []), variant('Gift Bundle', []), variant('Family Bundle', [])];
    expect(buildVariantMatrix(vs).mode).toBe('list');
  });
  it('inconsistent attribute sets', () => {
    const vs = [
      variant('Standard Pack', [['Pack', 'Standard']]),
      variant('Gift Bundle', [['Pack', 'Gift'], ['Wrap', 'Yes']]),
      variant('Family Bundle', [['Size', 'Family']]),
    ];
    expect(buildVariantMatrix(vs).mode).toBe('list');
  });
  it('duplicate attribute inside one variant', () => {
    expect(buildVariantMatrix([variant('x', [['Color', 'Red'], ['color', 'Blue']])]).mode).toBe('list');
  });
});

describe('default and active variants', () => {
  it('inactive variants are never offered', () => {
    const vs = [variant('a', [['S', '1']], { status: false, isDefault: true }), variant('b', [['S', '2']])];
    expect(getActiveVariants(vs).map((v) => v.name)).toEqual(['b']);
  });
  it('opens on the active default even when it is out of stock', () => {
    const vs = [variant('a', [['S', '1']]), variant('b', [['S', '2']], { isDefault: true, stock: 0 })];
    expect(pickInitialVariant(vs)?.name).toBe('b');
  });
  it('legacy data without a default falls back to the first active variant', () => {
    const vs = [variant('a', [['S', '1']], { stock: 0 }), variant('b', [['S', '2']])];
    expect(pickInitialVariant(vs)?.name).toBe('a');
    expect(pickInitialVariant([])).toBeNull();
  });
});

describe('order snapshot and localized display', () => {
  const snapshot = JSON.stringify({
    variantId: 'v1', sku: 'SKU-1', name: '256 GB / Black (old name)', nameAr: '256 / أسود',
    image: '/uploads/a.webp', imageAlt: 'Black phone', imageAltAr: 'هاتف أسود', price: 1000,
    attributeList: [{ name: 'Storage', nameAr: 'السعة', value: '256 GB' }, { name: 'Color', value: 'Black', valueAr: 'أسود' }],
  });
  it('parses the purchase-time snapshot including alt text', () => {
    const s = parseVariantSnapshot(snapshot)!;
    expect(s.name).toBe('256 GB / Black (old name)');
    expect(s.imageAltAr).toBe('هاتف أسود');
    expect(getLocalizedVariantName(s, true)).toBe('256 / أسود');
    expect(getLocalizedVariantAttributes(s.attributeList, true)).toEqual([
      { name: 'السعة', value: '256 GB' },
      { name: 'Color', value: 'أسود' },
    ]);
  });
  it('legacy orders without a snapshot render nothing', () => {
    expect(parseVariantSnapshot(null)).toBeNull();
    expect(parseVariantSnapshot('not json')).toBeNull();
  });
});
