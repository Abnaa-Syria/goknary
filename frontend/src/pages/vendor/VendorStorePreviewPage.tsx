import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye, Loader2, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import Storefront, { StorefrontVendor } from '../../components/vendor/Storefront';

type PreviewVendor = StorefrontVendor & { status?: string };

/**
 * Lets a vendor see their store as customers do without visiting the public `/store/:slug`
 * route, which VendorLockdown intentionally keeps off-limits for vendor accounts.
 */
const VendorStorePreviewPage: React.FC = () => {
  const { t } = useTranslation();
  const [vendor, setVendor] = useState<PreviewVendor | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get('/vendor/me')
      .then((res) => setVendor(res.data.vendor))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-purple-600" size={32} />
      </div>
    );
  }

  if (failed || !vendor) {
    return <div className="p-8 text-center text-gray-500">{t('vendor.failedLoadProfile', 'Failed to load store profile')}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-100 text-purple-800 rounded-2xl text-sm">
        <Eye size={18} className="mt-0.5 flex-shrink-0" />
        <span>{t('policies.previewBanner', 'Preview mode: this is how customers see your store. Links and buttons are disabled.')}</span>
      </div>
      {vendor.status && vendor.status !== 'APPROVED' && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 text-amber-800 rounded-2xl text-sm">
          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0" />
          <span>{t('policies.previewNotApproved', 'Your store is not approved yet, so customers cannot see it or its products.')}</span>
        </div>
      )}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <Storefront vendor={vendor} preview />
      </div>
    </div>
  );
};

export default VendorStorePreviewPage;
