export const isProductVisibleOnStore = (status: string): boolean =>
  status === 'ACTIVE' || status === 'APPROVED';

export const normalizeVendorProductStatusForForm = (status: string): string => {
  if (status === 'APPROVED') return 'ACTIVE';
  if (['ACTIVE', 'DRAFT', 'INACTIVE'].includes(status)) return status;
  return 'DRAFT';
};

/** Vendor-facing names: PENDING is "pending review", ACTIVE/APPROVED are both "published". */
export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending review',
  APPROVED: 'Published',
  ACTIVE: 'Published',
  REJECTED: 'Rejected',
  INACTIVE: 'Hidden',
};

export const PRODUCT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  PENDING: 'bg-blue-50 text-blue-700 border-blue-200',
  APPROVED: 'bg-green-50 text-green-700 border-green-200',
  ACTIVE: 'bg-green-50 text-green-700 border-green-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const canVendorSubmitProduct = (status: string) => status === 'DRAFT' || status === 'REJECTED';
