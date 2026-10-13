import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Sparkles, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector } from '../../store/hooks';
import { hasPermission } from '../../utils/permissions';
import DiscountSuggestionsPanel from '../../components/discounts/DiscountSuggestionsPanel';

interface GenerateSummary {
  productsEvaluated: number;
  created: number;
  skippedPending: number;
  skippedCooldown: number;
  skippedExistingDiscount: number;
}

const AdminDiscountSuggestionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const canDecide = hasPermission(user, 'UPDATE_PRODUCTS');
  const [vendors, setVendors] = useState<Array<{ id: string; storeName: string }>>([]);
  const [generating, setGenerating] = useState(false);
  const [lastRun, setLastRun] = useState<GenerateSummary | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api
      .get('/admin/vendors', { params: { status: 'APPROVED', limit: 100 } })
      .then((res) => setVendors((res.data.vendors || []).map((v: any) => ({ id: v.id, storeName: v.storeName }))))
      .catch(() => setVendors([]));
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/admin/discount-suggestions/generate', {});
      setLastRun(res.data.summary);
      toast.success(t('discountSuggestions.generated', '{{count}} new suggestions created', { count: res.data.summary?.created ?? 0 }));
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('discountSuggestions.generateFailed', 'Failed to generate suggestions'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Tag className="h-6 w-6 text-primary-600" />
            {t('discountSuggestions.adminTitle', 'Discount Suggestions')}
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {t('discountSuggestions.adminSubtitle', 'Rule-based suggestions. The vendor or an authorized admin decides; nothing is applied automatically.')}
          </p>
        </div>
        {canDecide && (
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {t('discountSuggestions.generate', 'Generate Suggestions')}
          </button>
        )}
      </div>

      {lastRun && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700" data-testid="generate-summary">
          {t('discountSuggestions.generateSummary', 'Evaluated {{evaluated}} products: {{created}} created, {{pending}} already pending, {{cooldown}} in cooldown, {{discounted}} already discounted.', {
            evaluated: lastRun.productsEvaluated,
            created: lastRun.created,
            pending: lastRun.skippedPending,
            cooldown: lastRun.skippedCooldown,
            discounted: lastRun.skippedExistingDiscount,
          })}
        </div>
      )}

      <DiscountSuggestionsPanel
        endpoint="/admin/discount-suggestions"
        canDecide={canDecide}
        showVendor
        vendorOptions={vendors}
        refreshKey={refreshKey}
      />
    </div>
  );
};

export default AdminDiscountSuggestionsPage;
