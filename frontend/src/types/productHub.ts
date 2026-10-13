import { VariantSnapshot } from '../lib/variants';

export interface ProductHubVendor {
  id: string;
  storeName: string;
  storeNameAr?: string | null;
  slug: string;
  status: string;
  commissionRate?: number | null;
}

export interface ProductHubCategory {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
}

export interface ProductHubBrand {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
}

export interface ProductHubDefaultVariant {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  sku?: string | null;
  price: number;
  discountPrice?: number | null;
  stock: number;
}

export interface ProductHubProductOverview {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  sku: string;
  mainImage: string | null;
  images: string[];
  imageMetadata?: any;
  vendor: ProductHubVendor;
  category: ProductHubCategory;
  brand: ProductHubBrand | null;
  status: 'DRAFT' | 'PENDING' | 'ACTIVE' | 'APPROVED' | 'INACTIVE' | 'REJECTED';
  featured: boolean;
  price: number;
  discountPrice?: number | null;
  discountType?: 'PERCENTAGE' | 'FIXED' | null;
  discountValue?: number | null;
  stock: number;
  lowStockThreshold: number;
  hasVariants: boolean;
  variantCount: number;
  activeVariantCount: number;
  outOfStockVariantCount: number;
  lowStockVariantCount: number;
  defaultVariant: ProductHubDefaultVariant | null;
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  reviewedBy?: string | null;
  reviewerName?: string | null;
}

export interface ProductHubVariantItem {
  id: string;
  name?: string | null;
  nameAr?: string | null;
  sku?: string | null;
  attributes: Array<{ name: string; value: string }>;
  image?: string | null;
  imageAlt?: string | null;
  imageAltAr?: string | null;
  price: number;
  discountPrice?: number | null;
  effectivePrice: number;
  stock: number;
  status: boolean;
  isDefault: boolean;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface ProductHubKpis {
  totalStock: number;
  deliveredUnitsSold: number;
  realizedRevenue: number;
  qualifyingOrdersCount: number;
  totalOrdersCount: number;
  inFlightUnits: number;
  lastPurchasedAt: string | null;
  totalReturnRequests: number;
  openReturnRequests: number;
  completedReturnedUnits: number;
  completedRefundAmount: number;
  returnRate: number;
  registeredViews: number;
  registeredUniqueViewers: number;
  registeredAddToCartActions: number;
  registeredUnitsAddedToCart: number;
  registeredCartCustomers: number;
  registeredWishlistAdds: number;
  registeredWishlistCustomers: number;
  registeredPurchasingCustomers: number;
  registeredConversionRate: number;
  bestSellingVariant: {
    key: string;
    name: string;
    nameAr?: string | null;
    sku?: string | null;
    unitsSold: number;
    revenue: number;
  } | null;
}

export interface ProductHubSalesByVariant {
  key: string;
  name: string;
  nameAr?: string | null;
  sku?: string | null;
  unitsSold: number;
  realizedRevenue: number;
  orderCount: number;
}

export interface ProductHubRecentOrderLine {
  id: string;
  variantId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  variantSnapshot: VariantSnapshot | null;
}

export interface ProductHubRecentOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  quantity: number;
  unitPrice: number;
  realizedRevenue: number;
  lines?: ProductHubRecentOrderLine[];
  variantSnapshot: VariantSnapshot | null;
  customer: {
    id: string;
    name: string;
    email?: string;
  } | null;
}

export interface ProductHubRecentReturn {
  id: string;
  createdAt: string;
  quantity: number;
  amount: number;
  reason?: string | null;
  status: string;
  orderId: string;
  orderNumber: string;
}

export interface ProductCommandCenterData {
  product: ProductHubProductOverview;
  variants: ProductHubVariantItem[];
  kpis: ProductHubKpis;
  salesByVariant: ProductHubSalesByVariant[];
  recentOrders: ProductHubRecentOrder[];
  recentReturns: ProductHubRecentReturn[];
}
