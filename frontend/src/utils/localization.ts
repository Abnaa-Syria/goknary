/**
 * Centralized Enum-to-Display mapping for raw backend database values.
 * 
 * IMPORTANT: These mappings are for dynamic backend values (e.g., PENDING, ADMIN)
 * that come from the database and cannot be part of the i18n JSON dictionaries.
 * They are NOT for static UI text — use t('key') for that.
 * 
 * Each map is keyed by the raw backend enum string and returns a human-readable
 * display string. The mapEnum() utility provides fallback-safe rendering.
 */

// ─── Safe enum mapper with fallback ─────────────────────────────────────────

export const mapEnum = (map: Record<string, string>, value: string): string => {
  return map[value] ?? value;
};

// ─── Order Status ───────────────────────────────────────────────────────────

export const orderStatusMap: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  CONFIRMED: 'مؤكد',
  PROCESSING: 'قيد المعالجة',
  SHIPPED: 'تم الشحن',
  DELIVERED: 'تم التوصيل',
  CANCELLED: 'ملغي',
  REFUNDED: 'مسترد',
};

// ─── Vendor Status ──────────────────────────────────────────────────────────

export const vendorStatusMap: Record<string, string> = {
  PENDING: 'قيد المراجعة',
  APPROVED: 'معتمد',
  REJECTED: 'مرفوض',
  SUSPENDED: 'موقوف',
};

// ─── User Roles ─────────────────────────────────────────────────────────────

export const roleMap: Record<string, string> = {
  ADMIN: 'مدير النظام',
  STAFF: 'موظف',
  VENDOR: 'بائع',
  CUSTOMER: 'عميل',
};

// ─── Coupon / Discount Types ────────────────────────────────────────────────

export const discountTypeMap: Record<string, string> = {
  PERCENTAGE: 'نسبة مئوية',
  FIXED: 'مبلغ ثابت',
};

// ─── Product Status ─────────────────────────────────────────────────────────

export const productStatusMap: Record<string, string> = {
  ACTIVE: 'نشط',
  INACTIVE: 'غير نشط',
  DRAFT: 'مسودة',
};

// ─── Egyptian Governorates ──────────────────────────────────────────────────

export const governorateMap: Record<string, string> = {
  CAIRO: 'القاهرة',
  GIZA: 'الجيزة',
  ALEXANDRIA: 'الإسكندرية',
  DAKAHLIA: 'الدقهلية',
  RED_SEA: 'البحر الأحمر',
  BEHEIRA: 'البحيرة',
  FAYOUM: 'الفيوم',
  GHARBIA: 'الغربية',
  ISMAILIA: 'الإسماعيلية',
  MENOFIA: 'المنوفية',
  MINYA: 'المنيا',
  QALIUBIYA: 'القليوبية',
  NEW_VALLEY: 'الوادي الجديد',
  SUEZ: 'السويس',
  ASWAN: 'أسوان',
  ASSIUT: 'أسيوط',
  BENI_SUEF: 'بني سويف',
  PORT_SAID: 'بور سعيد',
  DAMIETTA: 'دمياط',
  SHARKIA: 'الشرقية',
  SOUTH_SINAI: 'جنوب سيناء',
  KAFR_EL_SHEIKH: 'كفر الشيخ',
  MATRUH: 'مطروح',
  LUXOR: 'الأقصر',
  QENA: 'قنا',
  NORTH_SINAI: 'شمال سيناء',
  SOHAG: 'سوهاج',
};

// ─── Payment Methods ────────────────────────────────────────────────────────

export const paymentMethodMap: Record<string, string> = {
  COD: 'الدفع عند الاستلام',
  CARD: 'بطاقة ائتمان',
  WALLET: 'محفظة إلكترونية',
};
