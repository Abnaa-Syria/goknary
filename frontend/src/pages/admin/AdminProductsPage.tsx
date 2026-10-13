import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { ClipboardCheck, PackageSearch, Plus, Star } from 'lucide-react';
import api from 'lib/api';
import { useAppSelector } from 'store/hooks';
import { hasPermission } from 'utils/permissions';
import RejectProductModal from 'components/admin/RejectProductModal';
import ConfirmDialog from 'components/common/ConfirmDialog';
import ProductCatalogToolbar, { VendorOption } from 'components/catalog/ProductCatalogToolbar';
import CatalogSummaryStrip, { SummaryItem } from 'components/catalog/CatalogSummaryStrip';
import ProductCatalogList from 'components/catalog/ProductCatalogList';
import ProductCatalogActions from 'components/catalog/ProductCatalogActions';
import CatalogPagination from 'components/catalog/CatalogPagination';
import { useProductCatalog } from 'hooks/useProductCatalog';
import {
  CatalogActionId,
  CatalogFilterKey,
  CatalogProduct,
  countActiveFilters,
  getAdminActions,
  getApiErrorMessage,
  getLocalizedProductName,
} from 'lib/productCatalog';

const ADMIN_FILTERS: CatalogFilterKey[] = ['vendorId', 'status', 'categoryId', 'stock', 'featured'];

const SUMMARY_ITEMS: SummaryItem[] = [
  { key: 'total', filter: {} },
  { key: 'live', tone: 'success' },
  { key: 'pending', filter: { status: 'PENDING' }, tone: 'info' },
  { key: 'rejected', filter: { status: 'REJECTED' }, tone: 'danger' },
  { key: 'outOfStock', filter: { stock: 'out_of_stock' }, tone: 'danger' },
  { key: 'lowStock', filter: { stock: 'low_stock' }, tone: 'warning' },
];

type PendingConfirm = { action: 'hide' | 'delete'; product: CatalogProduct } | null;

/** Admin Product Catalog: every vendor's products, server-side search/filters/pagination, URL state. */
const AdminProductsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const caps = { canUpdate: hasPermission(user, 'UPDATE_PRODUCTS'), canDelete: hasPermission(user, 'DELETE_PRODUCTS') };
  const canCreate = hasPermission(user, 'CREATE_PRODUCTS');
  const canReadVendors = hasPermission(user, 'READ_VENDORS');

  const catalog = useProductCatalog({
    endpoint: '/admin/products',
    allowedFilters: ADMIN_FILTERS,
    summaryScope: (filters) => filters.vendorId,
  });
  const { filters, reload } = catalog;

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<CatalogProduct | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  useEffect(() => {
    let cancelled = false;
    // Staff without vendor access still get approved stores from the public directory.
    api
      .get(canReadVendors ? '/admin/vendors' : '/vendors', { params: { limit: 500 } })
      .then((response) => {
        if (cancelled) return;
        const list: any[] = response.data?.vendors ?? [];
        setVendors(
          list
            .map((vendor) => ({
              id: vendor.id,
              label: `${(isArabic && vendor.storeNameAr) || vendor.storeName}${vendor.status && vendor.status !== 'APPROVED' ? ` (${t(`catalog.vendorStatuses.${vendor.status}`, vendor.status)})` : ''}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        );
      })
      .catch(() => !cancelled && setVendors([]));
    api
      .get('/categories')
      .then((response) => !cancelled && setCategories(Array.isArray(response.data) ? response.data : []))
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, [canReadVendors, isArabic, t]);

  const run = useCallback(
    async (product: CatalogProduct, request: () => Promise<unknown>, success: string, fallback: string) => {
      setBusyId(product.id);
      try {
        await request();
        toast.success(success);
        reload();
        return true;
      } catch (error) {
        toast.error(getApiErrorMessage(error, isArabic, fallback));
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [isArabic, reload],
  );

  const handleAction = (product: CatalogProduct, action: CatalogActionId) => {
    const statusFailed = t('admin.pendingProducts.statusError', 'Failed to update product status');
    switch (action) {
      case 'preview':
        navigate(`/admin/products/${product.id}/preview`);
        break;
      case 'edit':
        navigate(`/admin/products/${product.id}/edit`);
        break;
      case 'approve':
        run(product, () => api.post(`/admin/products/${product.id}/approve`), t('admin.pendingProducts.approveSuccess', 'Product approved successfully'), statusFailed);
        break;
      case 'reject':
        setRejecting(product);
        break;
      case 'hide':
      case 'delete':
        setConfirm({ action, product });
        break;
      case 'republish':
        run(product, () => api.patch(`/admin/products/${product.id}/status`, { status: 'APPROVED' }), t('catalog.toast.republished'), statusFailed);
        break;
      case 'feature':
      case 'unfeature':
        run(
          product,
          () => api.patch(`/admin/products/${product.id}/featured`, { featured: action === 'feature' }),
          t(action === 'feature' ? 'catalog.toast.featured' : 'catalog.toast.unfeatured'),
          t('catalog.toast.featuredFailed'),
        );
        break;
      default:
        break;
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { action, product } = confirm;
    const done = action === 'hide'
      ? await run(product, () => api.patch(`/admin/products/${product.id}/status`, { status: 'INACTIVE' }), t('catalog.toast.hidden'), t('admin.pendingProducts.statusError', 'Failed to update product status'))
      : await run(product, () => api.delete(`/admin/products/${product.id}`), t('catalog.toast.deleted'), t('catalog.toast.deleteFailed'));
    if (done || action === 'delete') setConfirm(null);
  };

  const reject = async (reason: string) => {
    if (!rejecting) return;
    const done = await run(
      rejecting,
      () => api.post(`/admin/products/${rejecting.id}/reject`, { reason }),
      t('admin.pendingProducts.rejectSuccess', 'Product rejected'),
      t('admin.pendingProducts.statusError', 'Failed to update product status'),
    );
    if (done) setRejecting(null);
  };

  const filtered = countActiveFilters(filters) > 0;
  const pendingCount = catalog.summary?.pending ?? 0;
  const vendorLabel = vendors.find((vendor) => vendor.id === filters.vendorId)?.label;

  const empty = (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      <PackageSearch className="mx-auto text-gray-300" size={40} aria-hidden="true" />
      <h2 className="mt-3 text-lg font-bold text-gray-900">
        {filtered ? t('catalog.empty.filteredTitle') : t('catalog.empty.adminTitle')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{filtered ? t('catalog.empty.filteredHint') : t('catalog.empty.adminHint')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtered && (
          <button type="button" onClick={catalog.clearFilters} className="min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
            {t('catalog.filters.clear')}
          </button>
        )}
        {!filtered && canCreate && (
          <Link to="/admin/products/new" className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">
            <Plus size={16} aria-hidden="true" />
            {t('catalog.header.add')}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 text-start">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('catalog.header.adminTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('catalog.header.adminSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/pending-products"
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <ClipboardCheck size={16} aria-hidden="true" />
            {t('catalog.header.reviewQueue')}
            {pendingCount > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-600 text-white text-xs leading-[22px] text-center tabular-nums">
                {pendingCount}
                <span className="sr-only"> {t('catalog.summary.pending')}</span>
              </span>
            )}
          </Link>
          {canCreate && (
            <Link
              to={`/admin/products/new${filters.vendorId ? `?vendorId=${encodeURIComponent(filters.vendorId)}` : ''}`}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
            >
              <Plus size={16} aria-hidden="true" />
              {t('catalog.header.add')}
            </Link>
          )}
        </div>
      </header>

      <CatalogSummaryStrip
        summary={catalog.summary}
        items={SUMMARY_ITEMS}
        filters={filters}
        onApply={(filter) => catalog.updateFilters(filter)}
        scopeLabel={filters.vendorId ? t('catalog.summary.scopeVendor', { vendor: vendorLabel ?? '' }) : t('catalog.summary.scopeMarketplace')}
      />

      <ProductCatalogToolbar
        filters={filters}
        available={ADMIN_FILTERS}
        searchText={catalog.searchText}
        onSearchChange={catalog.setSearchText}
        searchPlaceholder={t('catalog.filters.adminSearchPlaceholder')}
        onChange={(changes) => catalog.updateFilters(changes)}
        onClear={catalog.clearFilters}
        categories={categories}
        vendors={vendors}
      />

      <ProductCatalogList
        products={catalog.products}
        columns={{ vendor: true, featured: true }}
        initialLoading={catalog.initialLoading}
        refreshing={catalog.loading && !catalog.initialLoading}
        error={catalog.error}
        errorMessage={getApiErrorMessage(catalog.error, isArabic, t('catalog.error.message'))}
        onRetry={reload}
        empty={empty}
        caption={t('catalog.header.adminTitle')}
        productHref={(product) => `/admin/products/${product.id}`}
        onOpenVariants={caps.canUpdate ? (product) => navigate(`/admin/products/${product.id}/edit`) : undefined}
        renderFeatured={(product) =>
          caps.canUpdate ? (
            <button
              type="button"
              aria-pressed={product.featured}
              disabled={busyId === product.id}
              onClick={() => handleAction(product, product.featured ? 'unfeature' : 'feature')}
              aria-label={`${t(product.featured ? 'catalog.featured.yes' : 'catalog.featured.no')} — ${getLocalizedProductName(product, isArabic)}`}
              title={t(product.featured ? 'catalog.actions.unfeature' : 'catalog.actions.feature')}
              className={`inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50 ${
                product.featured ? 'border-amber-300 bg-amber-50 text-amber-600' : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'
              }`}
            >
              <Star size={16} aria-hidden="true" fill={product.featured ? 'currentColor' : 'none'} />
            </button>
          ) : (
            <span className="text-xs text-gray-700">{t(product.featured ? 'catalog.featured.yes' : 'catalog.featured.no')}</span>
          )
        }
        renderActions={(product) => (
          <ProductCatalogActions
            actions={getAdminActions(product, caps).filter((action) => action !== 'feature' && action !== 'unfeature')}
            onAction={(action) => handleAction(product, action)}
            busy={busyId === product.id}
            productName={getLocalizedProductName(product, isArabic)}
          />
        )}
        footer={catalog.pagination && (
          <CatalogPagination
            pagination={catalog.pagination}
            disabled={catalog.loading}
            onPageChange={(page) => {
              catalog.updateFilters({ page });
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      />

      <RejectProductModal
        productName={rejecting ? getLocalizedProductName(rejecting, isArabic) : null}
        submitting={!!rejecting && busyId === rejecting.id}
        onCancel={() => setRejecting(null)}
        onConfirm={reject}
      />

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        busy={!!confirm && busyId === confirm.product.id}
        title={confirm?.action === 'delete' ? t('catalog.confirm.deleteTitle') : t('catalog.confirm.hideTitle')}
        message={
          confirm && (
            <>
              <p className="font-semibold text-gray-800">{getLocalizedProductName(confirm.product, isArabic)}</p>
              <p>{confirm.action === 'delete' ? t('catalog.confirm.deleteBody') : t('catalog.confirm.hideBodyAdmin')}</p>
            </>
          )
        }
        confirmLabel={confirm?.action === 'delete' ? t('catalog.actions.delete') : t('catalog.actions.hide')}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
};

export default AdminProductsPage;
