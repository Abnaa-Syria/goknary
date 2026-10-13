import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PackagePlus, PackageSearch, Plus, Upload } from 'lucide-react';
import api from '../../lib/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import ProductCatalogToolbar from '../../components/catalog/ProductCatalogToolbar';
import CatalogSummaryStrip, { SummaryItem } from '../../components/catalog/CatalogSummaryStrip';
import ProductCatalogList from '../../components/catalog/ProductCatalogList';
import ProductCatalogActions from '../../components/catalog/ProductCatalogActions';
import CatalogPagination from '../../components/catalog/CatalogPagination';
import ProductImportModal from '../../components/catalog/ProductImportModal';
import { useProductCatalog } from '../../hooks/useProductCatalog';
import {
  CatalogActionId,
  CatalogFilterKey,
  CatalogProduct,
  countActiveFilters,
  getApiErrorMessage,
  getLocalizedProductName,
  getVendorActions,
} from '../../lib/productCatalog';

const VENDOR_FILTERS: CatalogFilterKey[] = ['status', 'categoryId', 'stock'];

const SUMMARY_ITEMS: SummaryItem[] = [
  { key: 'total', filter: {} },
  { key: 'live', tone: 'success' },
  { key: 'pending', filter: { status: 'PENDING' }, tone: 'info' },
  { key: 'rejected', filter: { status: 'REJECTED' }, tone: 'danger' },
  { key: 'outOfStock', filter: { stock: 'out_of_stock' }, tone: 'danger' },
  { key: 'lowStock', filter: { stock: 'low_stock' }, tone: 'warning' },
];

type PendingConfirm = { action: 'hide' | 'delete'; product: CatalogProduct } | null;

/** Vendor Product Catalog: the same catalog components as admin, scoped to the vendor's own products. */
const VendorProductsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();

  const catalog = useProductCatalog({ endpoint: '/vendor/products', allowedFilters: VENDOR_FILTERS });
  const { filters, reload } = catalog;

  const [categories, setCategories] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<PendingConfirm>(null);
  const [importOpen, setImportOpen] = useState(false);
  const closeImport = useCallback(() => setImportOpen(false), []);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/categories')
      .then((response) => !cancelled && setCategories(Array.isArray(response.data) ? response.data : []))
      .catch(() => !cancelled && setCategories([]));
    return () => {
      cancelled = true;
    };
  }, []);

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
    const statusFailed = t('vendor.productsPage.statusUpdateFailed', 'Failed to update product status');
    switch (action) {
      case 'edit':
        navigate(`/vendor/products/${product.id}/edit`);
        break;
      case 'preview':
        navigate(`/vendor/products/${product.id}/preview`, { state: { catalogSearch: location.search } });
        break;
      case 'viewInStore':
        window.open(`/product/${encodeURIComponent(product.slug)}`, '_blank', 'noopener,noreferrer');
        break;
      case 'submit':
      case 'resubmit':
        run(product, () => api.post(`/vendor/products/${product.id}/submit`), t('moderation.submitted', 'Product submitted for review'), t('moderation.submitFailed', 'Failed to submit product for review'));
        break;
      case 'returnToDraft':
        run(product, () => api.patch(`/vendor/products/${product.id}`, { status: 'DRAFT' }), t('catalog.toast.returnedToDraft'), statusFailed);
        break;
      case 'sendForReview':
        run(product, () => api.patch(`/vendor/products/${product.id}`, { status: 'ACTIVE' }), t('vendor.productsPage.pendingReviewSuccess', 'Product submitted for review before appearing in the store'), statusFailed);
        break;
      case 'hide':
      case 'delete':
        setConfirm({ action, product });
        break;
      default:
        break;
    }
  };

  const confirmAction = async () => {
    if (!confirm) return;
    const { action, product } = confirm;
    const done = action === 'hide'
      ? await run(product, () => api.patch(`/vendor/products/${product.id}`, { status: 'INACTIVE' }), t('vendor.productsPage.hiddenSuccess', 'Product hidden from store'), t('vendor.productsPage.statusUpdateFailed', 'Failed to update product status'))
      : await run(product, () => api.delete(`/vendor/products/${product.id}`), t('catalog.toast.deleted'), t('catalog.toast.deleteFailed'));
    if (done || action === 'delete') setConfirm(null);
  };

  const filtered = countActiveFilters(filters) > 0;
  const firstProduct = !filtered && catalog.summary?.total === 0;

  const empty = (
    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
      {firstProduct ? (
        <PackagePlus className="mx-auto text-gray-300" size={40} aria-hidden="true" />
      ) : (
        <PackageSearch className="mx-auto text-gray-300" size={40} aria-hidden="true" />
      )}
      <h2 className="mt-3 text-lg font-bold text-gray-900">
        {filtered ? t('catalog.empty.filteredTitle') : t('catalog.empty.vendorTitle')}
      </h2>
      <p className="mt-1 text-sm text-gray-600">{filtered ? t('catalog.empty.filteredHint') : t('catalog.empty.vendorHint')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {filtered ? (
          <button type="button" onClick={catalog.clearFilters} className="min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900">
            {t('catalog.filters.clear')}
          </button>
        ) : (
          <Link to="/vendor/products/new" className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800">
            <Plus size={16} aria-hidden="true" />
            {t('catalog.empty.vendorAction')}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-4 text-start">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{t('catalog.header.vendorTitle')}</h1>
          <p className="mt-1 text-sm text-gray-600">{t('catalog.header.vendorSubtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-800 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900"
          >
            <Upload size={16} aria-hidden="true" />
            {t('catalog.header.import')}
          </button>
          <Link
            to="/vendor/products/new"
            className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900"
          >
            <Plus size={16} aria-hidden="true" />
            {t('catalog.header.add')}
          </Link>
        </div>
      </header>

      <CatalogSummaryStrip
        summary={catalog.summary}
        items={SUMMARY_ITEMS}
        filters={filters}
        onApply={(filter) => catalog.updateFilters(filter)}
        scopeLabel={t('catalog.summary.scopeStore')}
      />

      <ProductCatalogToolbar
        filters={filters}
        available={VENDOR_FILTERS}
        searchText={catalog.searchText}
        onSearchChange={catalog.setSearchText}
        searchPlaceholder={t('catalog.filters.vendorSearchPlaceholder')}
        onChange={(changes) => catalog.updateFilters(changes)}
        onClear={catalog.clearFilters}
        categories={categories}
      />

      <ProductCatalogList
        products={catalog.products}
        columns={{}}
        initialLoading={catalog.initialLoading}
        refreshing={catalog.loading && !catalog.initialLoading}
        error={catalog.error}
        errorMessage={getApiErrorMessage(catalog.error, isArabic, t('catalog.error.message'))}
        onRetry={reload}
        empty={empty}
        caption={t('catalog.header.vendorTitle')}
        productHref={(product) => `/vendor/products/${product.id}`}
        onOpenVariants={(product) => navigate(`/vendor/products/${product.id}/edit`)}
        renderActions={(product) => (
          <ProductCatalogActions
            actions={getVendorActions(product)}
            primaryCount={product.status === 'ACTIVE' || product.status === 'APPROVED' ? 2 : 3}
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

      <ConfirmDialog
        open={!!confirm}
        tone="danger"
        busy={!!confirm && busyId === confirm.product.id}
        title={confirm?.action === 'delete' ? t('catalog.confirm.deleteTitle') : t('catalog.confirm.hideTitle')}
        message={
          confirm && (
            <>
              <p className="font-semibold text-gray-800">{getLocalizedProductName(confirm.product, isArabic)}</p>
              <p>{confirm.action === 'delete' ? t('catalog.confirm.deleteBody') : t('catalog.confirm.hideBodyVendor')}</p>
            </>
          )
        }
        confirmLabel={confirm?.action === 'delete' ? t('catalog.actions.delete') : t('catalog.actions.hide')}
        onConfirm={confirmAction}
        onCancel={() => setConfirm(null)}
      />

      <ProductImportModal open={importOpen} onClose={closeImport} onImported={reload} categories={categories} />
    </div>
  );
};

export default VendorProductsPage;
