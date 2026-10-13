import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, Loader2, Tag, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';

export type SuggestionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const SUGGESTION_REASONS = ['HIGH_VIEWS_LOW_CONVERSION', 'HIGH_WISHLIST_LOW_SALES', 'SLOW_MOVING_STOCK'] as const;

export interface DiscountSuggestion {
  id: string;
  productId: string;
  vendorId: string;
  reasonType: string;
  suggestedType: 'PERCENTAGE' | 'FIXED';
  suggestedValue: number;
  reason: string;
  status: SuggestionStatus;
  decidedByRole?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  metrics: Record<string, number | null | undefined>;
  product: {
    id: string;
    name: string;
    nameAr: string | null;
    slug: string;
    image: string | null;
    price: number;
    discountPrice: number | null;
    stock: number;
    hasVariants: boolean;
  } | null;
  vendor?: { id: string; storeName: string };
}

interface Filters {
  status: string;
  reason: string;
  vendorId: string;
}

interface DiscountSuggestionsPanelProps {
  /** `/vendor/discount-suggestions` or `/admin/discount-suggestions`. */
  endpoint: string;
  canDecide: boolean;
  showVendor?: boolean;
  vendorOptions?: Array<{ id: string; storeName: string }>;
  /** Changing this number reloads the list (e.g. after the admin generates suggestions). */
  refreshKey?: number;
}

const REASON_FALLBACK: Record<string, string> = {
  HIGH_VIEWS_LOW_CONVERSION: 'Many views, few purchases',
  HIGH_WISHLIST_LOW_SALES: 'Wishlisted but not bought',
  SLOW_MOVING_STOCK: 'Slow-moving stock',
};

const STATUS_STYLE: Record<SuggestionStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  APPROVED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-gray-200 text-gray-700',
};

const errorText = (err: any, fallback: string) => err?.response?.data?.error || fallback;

/** Same 2-decimal formula as utils/discount.ts calculateDiscountPrice. */
const previewPrice = (price: number, percent: number) => Number((price - (price * percent) / 100).toFixed(2));

const DiscountSuggestionsPanel: React.FC<DiscountSuggestionsPanelProps> = ({
  endpoint,
  canDecide,
  showVendor = false,
  vendorOptions = [],
  refreshKey = 0,
}) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const [filters, setFilters] = useState<Filters>({ status: 'PENDING', reason: '', vendorId: '' });
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DiscountSuggestion[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(endpoint, {
        params: {
          page,
          limit: 20,
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.reason ? { reason: filters.reason } : {}),
          ...(showVendor && filters.vendorId ? { vendorId: filters.vendorId } : {}),
        },
      });
      setItems(res.data.suggestions || []);
      setTotalPages(Math.max(1, res.data.pagination?.totalPages || 1));
    } catch (err) {
      toast.error(errorText(err, t('discountSuggestions.loadFailed', 'Failed to load suggestions')));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, filters, showVendor, t]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const decide = async (suggestion: DiscountSuggestion, action: 'approve' | 'reject') => {
    const question =
      action === 'approve'
        ? t('discountSuggestions.confirmApprove', 'Apply a {{percent}}% discount to this product now?', { percent: suggestion.suggestedValue })
        : t('discountSuggestions.confirmReject', 'Reject this suggestion? Prices will not change.');
    if (!window.confirm(question)) return;
    setBusyId(suggestion.id);
    try {
      await api.patch(`${endpoint}/${suggestion.id}`, { action });
      toast.success(
        action === 'approve'
          ? t('discountSuggestions.approved', 'Discount applied')
          : t('discountSuggestions.rejected', 'Suggestion rejected')
      );
    } catch (err) {
      toast.error(errorText(err, t('discountSuggestions.decisionFailed', 'Could not update the suggestion')));
    } finally {
      setBusyId(null);
      load();
    }
  };

  const reasonLabel = (type: string) => t(`discountSuggestions.reasons.${type}`, REASON_FALLBACK[type] ?? type);

  const evidence = (s: DiscountSuggestion) => {
    const m = s.metrics || {};
    switch (s.reasonType) {
      case 'HIGH_VIEWS_LOW_CONVERSION':
        return t('discountSuggestions.evidence.HIGH_VIEWS_LOW_CONVERSION', '{{viewers}} customers viewed it in the last {{days}} days and {{purchasers}} bought it ({{rate}}% conversion, target {{target}}%).', {
          viewers: m.uniqueViewers ?? 0,
          days: m.windowDays ?? 30,
          purchasers: m.purchasingCustomers ?? 0,
          rate: m.conversionRate ?? 0,
          target: m.conversionThreshold ?? 0,
        });
      case 'HIGH_WISHLIST_LOW_SALES':
        return t('discountSuggestions.evidence.HIGH_WISHLIST_LOW_SALES', '{{wishlist}} customers added it to their wishlist in the last {{days}} days and {{purchasers}} bought it.', {
          wishlist: m.wishlistCustomers ?? 0,
          days: m.windowDays ?? 30,
          purchasers: m.purchasingCustomers ?? 0,
        });
      case 'SLOW_MOVING_STOCK':
        return t('discountSuggestions.evidence.SLOW_MOVING_STOCK', '{{stock}} units in stock and {{units}} delivered in the last {{days}} days.', {
          stock: m.stock ?? 0,
          units: m.slowWindowUnits ?? 0,
          days: m.slowWindowDays ?? 60,
        });
      default:
        return s.reason;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>{t('discountSuggestions.notice', 'Suggestion only — no discount is applied until you approve.')}</span>
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          aria-label={t('discountSuggestions.filterStatus', 'Status')}
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t('discountSuggestions.allStatuses', 'All statuses')}</option>
          {(['PENDING', 'APPROVED', 'REJECTED'] as SuggestionStatus[]).map((status) => (
            <option key={status} value={status}>
              {t(`discountSuggestions.status.${status}`, status)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('discountSuggestions.filterReason', 'Reason')}
          value={filters.reason}
          onChange={(e) => setFilter('reason', e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">{t('discountSuggestions.allReasons', 'All reasons')}</option>
          {SUGGESTION_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {reasonLabel(reason)}
            </option>
          ))}
        </select>
        {showVendor && vendorOptions.length > 0 && (
          <select
            aria-label={t('discountSuggestions.filterVendor', 'Vendor')}
            value={filters.vendorId}
            onChange={(e) => setFilter('vendorId', e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">{t('discountSuggestions.allVendors', 'All vendors')}</option>
            {vendorOptions.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.storeName}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white py-12 text-center text-gray-500">
          {t('discountSuggestions.empty', 'No suggestions to show.')}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const product = s.product;
            const name = product ? (isAr && product.nameAr ? product.nameAr : product.name) : t('discountSuggestions.deletedProduct', 'Deleted product');
            const currentPrice = product ? product.discountPrice || product.price : 0;
            const currentDiscount = Number(s.metrics?.currentDiscountPercent ?? 0);
            return (
              <div key={s.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row" data-testid="discount-suggestion">
                <img
                  src={getImageUrl(product?.image || undefined)}
                  alt={name}
                  className="h-20 w-20 flex-shrink-0 rounded-lg bg-gray-100 object-cover"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>
                      {t(`discountSuggestions.status.${s.status}`, s.status)}
                    </span>
                    {showVendor && s.vendor && <span className="text-xs text-gray-500">{s.vendor.storeName}</span>}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{reasonLabel(s.reasonType)}</p>
                  <p className="text-sm text-gray-600">{evidence(s)}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    <span>{t('discountSuggestions.views', 'Views')}: {s.metrics?.views ?? 0}</span>
                    <span>{t('discountSuggestions.conversion', 'Conversion')}: {s.metrics?.conversionRate ?? '—'}{s.metrics?.conversionRate != null ? '%' : ''}</span>
                    <span>{t('discountSuggestions.wishlist', 'Wishlist')}: {s.metrics?.wishlistCustomers ?? 0}</span>
                    <span>{t('discountSuggestions.recentSales', 'Units sold')}: {s.metrics?.unitsSold ?? 0}</span>
                    <span>{t('discountSuggestions.stock', 'Stock')}: {product?.stock ?? s.metrics?.stock ?? 0}</span>
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-col items-start gap-2 sm:items-end">
                  {product && (
                    <div className="text-sm text-gray-600 sm:text-end">
                      <div>
                        {t('discountSuggestions.currentPrice', 'Current price')}: <span className="font-semibold">{formatPrice(currentPrice)}</span>
                      </div>
                      <div>
                        {t('discountSuggestions.currentDiscount', 'Current discount')}: {currentDiscount > 0 ? `${currentDiscount}%` : t('discountSuggestions.none', 'None')}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-1 rounded-lg bg-primary-50 px-3 py-1.5 text-primary-700">
                    <Tag className="h-4 w-4" />
                    <span className="font-bold">{t('discountSuggestions.suggested', 'Suggested')}: {s.suggestedValue}%</span>
                  </div>
                  {product && (
                    <div className="text-xs text-gray-500">
                      {product.hasVariants
                        ? t('discountSuggestions.variantNote', 'Applied to each option’s own price')
                        : t('discountSuggestions.newPrice', 'New price: {{price}}', { price: formatPrice(previewPrice(product.price, s.suggestedValue)) })}
                    </div>
                  )}
                  {canDecide && s.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decide(s, 'approve')}
                        disabled={busyId === s.id}
                        className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> {t('discountSuggestions.approve', 'Approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => decide(s, 'reject')}
                        disabled={busyId === s.id}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <X className="h-4 w-4" /> {t('discountSuggestions.reject', 'Reject')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded border px-3 py-1 disabled:opacity-50">
            {t('common.previous', 'Previous')}
          </button>
          <span>
            {page} / {totalPages}
          </span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded border px-3 py-1 disabled:opacity-50">
            {t('common.next', 'Next')}
          </button>
        </div>
      )}
    </div>
  );
};

export default DiscountSuggestionsPanel;
