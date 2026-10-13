import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Package, AlertCircle, RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { ProductCommandCenterData } from '../../types/productHub';
import {
  ProductHubHeader,
  ProductHubKpis,
  ProductHubOverview,
  ProductVariantsInventory,
  ProductRecentOrders,
  ProductReturns,
  ProductPerformance,
  ProductModeration,
  ProductHubSkeleton,
} from '../../components/productHub';
import RejectProductModal from '../../components/admin/RejectProductModal';
import toast from 'react-hot-toast';

interface ProductCommandCenterPageProps {
  role: 'admin' | 'vendor';
}

export const ProductCommandCenterPage: React.FC<ProductCommandCenterPageProps> = ({ role }) => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [data, setData] = useState<ProductCommandCenterData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Reject modal state for Admin
  const [rejecting, setRejecting] = useState<boolean>(false);
  const [rejectBusy, setRejectBusy] = useState<boolean>(false);

  const fetchHubData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setIsNotFound(false);

    const endpoint = role === 'admin' ? `/admin/products/${id}/hub` : `/vendor/products/${id}/hub`;

    try {
      const response = await api.get<ProductCommandCenterData>(endpoint);
      setData(response.data);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setIsNotFound(true);
      } else {
        const msg = err.response?.data?.error || t('common.errorOccurred', 'Failed to load product data');
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [id, role, t]);

  useEffect(() => {
    fetchHubData();
  }, [fetchHubData]);

  const handleAdminRejectConfirm = async (reason: string) => {
    if (!id) return;
    setRejectBusy(true);
    try {
      await api.post(`/admin/products/${id}/reject`, { reason });
      toast.success(t('admin.pendingProducts.rejectSuccess', 'Product rejected'));
      setRejecting(false);
      fetchHubData();
    } catch (err: any) {
      const msg = err.response?.data?.error || t('admin.pendingProducts.statusError', 'Failed to reject product');
      toast.error(msg);
    } finally {
      setRejectBusy(false);
    }
  };

  const catalogPath = role === 'admin' ? '/admin/products' : '/vendor/products';

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <ProductHubSkeleton />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Package size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {t('productHub.notFoundTitle', 'Product Not Found')}
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {t(
            'productHub.notFoundBody',
            'The requested product does not exist, or you do not have permission to view it.'
          )}
        </p>
        <Link
          to={catalogPath}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
        >
          {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          <span>{t('productHub.backToCatalog', 'Back to Products Catalog')}</span>
        </Link>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-200">
          <AlertCircle size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {t('productHub.errorTitle', 'Unable to Load Product Command Center')}
        </h1>
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {error || t('common.errorOccurred', 'An error occurred while communicating with the server.')}
        </p>
        <button
          type="button"
          onClick={fetchHubData}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          <RefreshCw size={15} />
          <span>{t('common.retry', 'Retry')}</span>
        </button>
      </div>
    );
  }

  const { product, variants, kpis, salesByVariant, recentOrders, recentReturns } = data;
  const productName = (isRTL && product.nameAr) || product.name || 'Product';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-16">
      {/* 1. Header with Title, Badges, and Quick Actions */}
      <ProductHubHeader
        product={product}
        role={role}
        onReload={fetchHubData}
        onOpenRejectModal={role === 'admin' && product.status === 'PENDING' ? () => setRejecting(true) : undefined}
      />

      {/* 2. Compact KPI Row */}
      <ProductHubKpis kpis={kpis} />

      {/* 3. Operational Health & Lifecycle */}
      <ProductHubOverview product={product} role={role} />

      {/* 4. Variants & Stock Breakdown */}
      <ProductVariantsInventory
        variants={variants}
        productId={product.id}
        lowStockThreshold={product.lowStockThreshold}
        role={role}
      />

      {/* 5. Customer Engagement & Conversion (with Logged-in Customer Disclaimer) */}
      <ProductPerformance kpis={kpis} salesByVariant={salesByVariant} />

      {/* 6. Recent Orders Section */}
      <ProductRecentOrders orders={recentOrders} role={role} />

      {/* 7. Returns & Claims Section */}
      <ProductReturns returns={recentReturns} kpis={kpis} role={role} />

      {/* 8. Moderation & Governance Log */}
      <ProductModeration product={product} role={role} />

      {/* Admin Reject Modal */}
      {role === 'admin' && (
        <RejectProductModal
          productName={rejecting ? productName : null}
          submitting={rejectBusy}
          onCancel={() => setRejecting(false)}
          onConfirm={handleAdminRejectConfirm}
        />
      )}
    </div>
  );
};

export default ProductCommandCenterPage;
