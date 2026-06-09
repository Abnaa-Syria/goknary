import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPackage, FiSearch, FiTrash, FiXCircle } from 'react-icons/fi';
import { Eye, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from 'lib/api';
import { formatPrice } from 'lib/utils';
import { getImageUrl } from 'utils/image';
import { mapEnum, productStatusMap } from 'utils/localization';
import { useAppSelector } from 'store/hooks';
import { hasPermission } from 'utils/permissions';

interface PendingProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  discountPrice?: number | null;
  stock: number;
  status: string;
  images: string | string[];
  createdAt: string;
  category?: { name: string };
  brand?: { name: string };
  vendor: {
    id: string;
    storeName: string;
    slug: string;
    user?: {
      name?: string;
      email?: string;
    };
  };
}

const parseImages = (images: string | string[]): string[] => {
  if (Array.isArray(images)) return images;

  try {
    const parsed = JSON.parse(images || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return images ? [images] : [];
  }
};

const AdminPendingProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const [products, setProducts] = useState<PendingProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0,
  });

  const canUpdate = hasPermission(user, 'UPDATE_PRODUCTS');
  const canDelete = hasPermission(user, 'DELETE_PRODUCTS');

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = {
        page: pagination.page,
        limit: 10,
      };

      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }

      const response = await api.get('/admin/products/pending', { params });
      setProducts(response.data.products || []);
      setPagination((prev) => ({
        ...prev,
        totalPages: response.data.pagination?.totalPages || 1,
        totalCount: response.data.pagination?.totalCount || 0,
      }));
    } catch (error) {
      console.error('Failed to fetch pending products:', error);
      toast.error(t('admin.pendingProducts.fetchError', 'Failed to load pending products'));
    } finally {
      setLoading(false);
    }
  }, [pagination.page, searchTerm, t]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(timeout);
  }, [fetchProducts]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [searchTerm]);

  const pendingLabel = useMemo(
    () => t('admin.pendingProducts.subtitle', 'Review vendor products before publishing'),
    [t]
  );

  const handleStatusUpdate = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    if (status === 'REJECTED') {
      const confirmed = window.confirm(
        t('admin.pendingProducts.rejectConfirm', 'Are you sure you want to reject this product?')
      );
      if (!confirmed) return;
    }

    try {
      await api.patch(`/admin/products/${id}/status`, { status });
      toast.success(
        status === 'APPROVED'
          ? t('admin.pendingProducts.approveSuccess', 'Product approved successfully')
          : t('admin.pendingProducts.rejectSuccess', 'Product rejected')
      );
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.pendingProducts.statusError', 'Failed to update product status'));
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm(
      t('admin.pendingProducts.deleteConfirm', 'Are you sure you want to permanently delete this product?')
    );
    if (!confirmed) return;

    try {
      await api.delete(`/admin/products/${id}`);
      toast.success(t('admin.pendingProducts.deleteSuccess', 'Product deleted successfully'));
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.pendingProducts.deleteError', 'Failed to delete product'));
    }
  };

  if (loading && pagination.page === 1) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">
            {t('admin.pendingProducts.title', 'Pending Products')}
          </h1>
          <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">
            {pendingLabel}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <FiSearch className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full sm:w-80 bg-gray-50 border border-gray-100 rounded-2xl py-4 ps-11 pe-5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
              placeholder={t('admin.pendingProducts.search', 'Search product, SKU or vendor...')}
            />
          </div>
          <button
            onClick={fetchProducts}
            className="flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all active:scale-95"
          >
            <RefreshCw size={16} /> {t('common.refresh', 'Refresh')}
          </button>
        </div>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-24 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiPackage className="text-green-500" style={{ width: 32, height: 32 }} />
          </div>
          <h3 className="text-xl font-black text-gray-900 uppercase">
            {t('admin.pendingProducts.emptyTitle', 'All Caught Up')}
          </h3>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">
            {t('admin.pendingProducts.emptyDesc', 'There are no vendor products waiting for review.')}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t('admin.pendingProducts.table.product', 'Product')}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t('admin.pendingProducts.table.vendor', 'Vendor')}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t('admin.pendingProducts.table.priceStock', 'Price / Stock')}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    {t('admin.pendingProducts.table.status', 'Status')}
                  </th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-end">
                    {t('admin.pendingProducts.table.actions', 'Actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((product) => {
                  const images = parseImages(product.images);
                  const mainImage = images[0] || '/imgs/default-product.jpg';

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100 shadow-sm">
                            <img src={getImageUrl(mainImage)} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 leading-tight">{product.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{product.sku}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg">
                                {product.category?.name || t('common.uncategorized', 'Uncategorized')}
                              </span>
                              {product.brand?.name && (
                                <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-blue-50 text-blue-500 rounded-lg">
                                  {product.brand.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-sm font-black text-gray-900">{product.vendor.storeName}</p>
                        <p className="text-[10px] font-bold text-gray-400 mt-1">
                          {product.vendor.user?.email || product.vendor.user?.name || product.vendor.slug}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        {product.discountPrice ? (
                          <div>
                            <p className="text-sm font-black text-primary-600">{formatPrice(product.discountPrice)}</p>
                            <p className="text-[10px] font-bold text-gray-400 line-through mt-0.5">{formatPrice(product.price)}</p>
                          </div>
                        ) : (
                          <p className="text-sm font-black text-gray-900">{formatPrice(product.price)}</p>
                        )}
                        <p className={`text-[10px] font-bold uppercase mt-1.5 ${product.stock > 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {product.stock} {t('common.inStock', 'in stock')}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-yellow-100 text-yellow-700">
                          {mapEnum(productStatusMap, product.status)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/admin/vendors/${product.vendor.id}/products`)}
                            className="p-3 text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
                            title={t('admin.pendingProducts.viewVendorProducts', 'View vendor products')}
                          >
                            <Eye size={18} />
                          </button>
                          {canUpdate && (
                            <button
                              onClick={() => handleStatusUpdate(product.id, 'APPROVED')}
                              className="p-3 text-green-500 hover:bg-green-50 rounded-2xl transition-all"
                              title={t('admin.pendingProducts.approve', 'Approve')}
                            >
                              <FiCheckCircle />
                            </button>
                          )}
                          {canUpdate && (
                            <button
                              onClick={() => handleStatusUpdate(product.id, 'REJECTED')}
                              className="p-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                              title={t('admin.pendingProducts.reject', 'Reject')}
                            >
                              <FiXCircle />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                              title={t('common.delete', 'Delete')}
                            >
                              <FiTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {pagination.totalPages > 1 && (
            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t('admin.pendingProducts.pagination', {
                  current: pagination.page,
                  total: pagination.totalPages,
                  defaultValue: `Page ${pagination.page} of ${pagination.totalPages}`,
                })}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-30 active:scale-95"
                >
                  {t('common.prev', 'Prev')}
                </button>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-30 active:scale-95"
                >
                  {t('common.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPendingProductsPage;
