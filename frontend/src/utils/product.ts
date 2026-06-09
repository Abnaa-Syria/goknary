export const isProductVisibleOnStore = (status: string): boolean =>
  status === 'ACTIVE' || status === 'APPROVED';

export const normalizeVendorProductStatusForForm = (status: string): string => {
  if (status === 'APPROVED') return 'ACTIVE';
  if (['ACTIVE', 'DRAFT', 'INACTIVE'].includes(status)) return status;
  return 'DRAFT';
};
