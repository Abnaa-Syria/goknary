import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector } from 'store/hooks';
import { hasPermission } from 'utils/permissions';
import {
  FiArrowLeft,
  FiTrash,
  FiCheckCircle,
  FiXCircle,
  FiPackage,
  FiPlusCircle,
  FiEdit2,
  FiX
} from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from 'lib/api';
import { formatPrice } from 'lib/utils';
import ImageUploader from 'components/common/ImageUploader';
import { uploadImages } from 'utils/upload';
import { getImageUrl } from 'utils/image';
import { mapEnum, productStatusMap } from 'utils/localization';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  discountPrice?: number;
  discountType?: string;
  stock: number;
  status: string;
  description?: string;
  categoryId: string;
  brandId?: string;
  category?: { name: string };
  brand?: { name: string };
  images: string | string[];
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

const AdminProductsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);

  // Vendor State
  const [vendors, setVendors] = useState<any[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>('');

  // Table State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0
  });

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Dropdown Data
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    categoryId: '',
    brandId: '',
    images: [] as (File | string)[],
    status: 'ACTIVE',
    discountType: '',
    discountValue: '',
    discountPrice: ''
  });

  // Real-time Discount Calculation Logic
  useEffect(() => {
    const p = parseFloat(formData.price) || 0;
    const v = parseFloat(formData.discountValue) || 0;

    if (formData.discountType) {
      let finalP = p;
      if (formData.discountType === 'PERCENTAGE') {
        finalP = p - (p * v / 100);
      } else if (formData.discountType === 'FIXED') {
        finalP = p - v;
      }
      const calculated = Math.max(0, finalP).toFixed(2).toString();
      if (calculated !== formData.discountPrice) {
        setFormData(prev => ({ ...prev, discountPrice: calculated }));
      }
    } else if (formData.discountPrice !== '') {
      setFormData(prev => ({ ...prev, discountPrice: '' }));
    }
  }, [formData.price, formData.discountType, formData.discountValue]);

  useEffect(() => {
    fetchMetadata();
    fetchVendors();
  }, []);

  useEffect(() => {
    if (selectedVendorId) {
      fetchProducts();
    } else {
      setProducts([]);
    }
  }, [selectedVendorId, pagination.page]);

  const fetchVendors = async () => {
    try {
      const response = await api.get('/vendors', { params: { limit: 1000, approved: true } });
      setVendors(response.data.vendors || response.data || []);
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/admin/vendors/${selectedVendorId}/products`, {
        params: { page: pagination.page, limit: 10 }
      });
      setProducts(response.data.products || []);
      if (response.data.pagination) {
        setPagination(prev => ({
          ...prev,
          totalPages: response.data.pagination.totalPages || 1,
          totalCount: response.data.pagination.totalCount || 0
        }));
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error(t('admin.vendorProducts.fetchError', 'Failed to synchronize with vendor catalog ecosystem'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [catsRes, brandsRes] = await Promise.all([
        api.get('/categories'),
        api.get('/brands')
      ]);

      setCategories(Array.isArray(catsRes.data) ? catsRes.data : []);

      const brandsData = brandsRes.data.brands || (Array.isArray(brandsRes.data) ? brandsRes.data : []);
      setBrands(brandsData);
    } catch (error) {
      console.error('Failed to fetch metadata:', error);
    }
  };

  const handleOpenModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description || '',
        price: product.price.toString(),
        stock: product.stock.toString(),
        categoryId: product.categoryId || '',
        brandId: product.brandId || '',
        images: typeof product.images === 'string' ? JSON.parse(product.images) : product.images,
        status: product.status,
        discountType: product.discountType || '',
        discountValue: '',
        discountPrice: product.discountPrice ? product.discountPrice.toString() : ''
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        description: '',
        price: '',
        stock: '',
        categoryId: '',
        brandId: '',
        images: [],
        status: 'ACTIVE',
        discountType: '',
        discountValue: '',
        discountPrice: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (!formData.images || formData.images.length === 0) {
        toast.error(t('admin.vendorProducts.imageRequired', 'Critical: At least one visual asset is required to establish a catalog entry'));
        setSubmitting(false);
        return;
      }

      const hasDiscount = !!formData.discountType;

      // Global Image Refactor: Batch Upload phase
      const uploadedImageUrls = await uploadImages(formData.images);

      const payload = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        images: uploadedImageUrls, // Send only the resolved string URLs to the backend
        discountType: hasDiscount ? formData.discountType : null,
        discountValue: hasDiscount && formData.discountValue ? parseFloat(formData.discountValue) : null,
        discountPrice: hasDiscount && formData.discountPrice ? parseFloat(formData.discountPrice) : null,
        vendorId: selectedVendorId
      };

      if (editingProduct) {
        await api.patch(`/vendor/products/${editingProduct.id}`, payload);
        toast.success(t('admin.vendorProducts.updateSuccess', 'Product entity successfully modified'));
      } else {
        await api.post('/vendor/products', payload);
        toast.success(t('admin.vendorProducts.createSuccess', 'New product entry established in catalog'));
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('common.error', 'Operation failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (id: string, status: string) => {
    try {
      await api.patch(`/admin/products/${id}/status`, { status });
      toast.success(t('admin.vendorProducts.statusSuccess', `Product status successfully updated to ${status}`));
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorProducts.statusError', 'Failed to override product state'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.vendorProducts.deleteConfirm', 'CRITICAL ACTION: Are you sure you want to permanently purge this product from the master catalog?'))) return;

    try {
      await api.delete(`/admin/products/${id}`);
      toast.success(t('admin.vendorProducts.deleteSuccess', 'Product successfully decommissioned'));
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorProducts.deleteError', 'Failed to purge product entity'));
    }
  };

  if (loading && pagination.page === 1 && selectedVendorId) {
    return (
      <div className="flex items-center justify-center p-24">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  const canCreate = hasPermission(user, 'CREATE_PRODUCTS');
  const canUpdate = hasPermission(user, 'UPDATE_PRODUCTS');
  const canDelete = hasPermission(user, 'DELETE_PRODUCTS');

  return (
    <div className="space-y-6">
      {/* Header Area */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase leading-none">{t('admin.products', 'Global Products')}</h1>
          <p className="text-[11px] font-bold text-gray-400 mt-2 uppercase tracking-[0.2em]">{t('admin.products.subtitle', 'Manage Vendor Inventories')}</p>
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={selectedVendorId}
            onChange={(e) => {
              setSelectedVendorId(e.target.value);
              setPagination(p => ({ ...p, page: 1 }));
            }}
            className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold w-64 outline-none focus:border-primary-500 transition-all appearance-none"
          >
            <option value="">{t('admin.selectVendor', 'Select a vendor...')}</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.storeName}</option>
            ))}
          </select>

          {canCreate && selectedVendorId && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all shadow-lg hover:shadow-primary-500/25 active:scale-95"
            >
              <FiPlusCircle /> {t('admin.vendorProducts.create', 'Add Product')}
            </button>
          )}
        </div>
      </div>

      {!selectedVendorId ? (
        <div className="bg-white rounded-[2.5rem] p-24 text-center border border-gray-100 shadow-sm animate-in fade-in">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiPackage className="text-gray-300" style={{ width: 32, height: 32 }} />
          </div>
          <h3 className="text-xl font-black text-gray-900 uppercase">{t('admin.selectVendorTitle', 'Vendor Required')}</h3>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">{t('admin.selectVendorDesc', 'Please select a vendor from the dropdown to view and manage their products.')}</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-24 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <FiPackage className="text-gray-300" style={{ width: 32, height: 32 }} />
          </div>
          <h3 className="text-xl font-black text-gray-900 uppercase">{t('admin.vendorProducts.emptyTitle', 'Ecosystem Void')}</h3>
          <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">{t('admin.vendorProducts.emptyDesc', 'This vendor currently has no registered entities in the catalog')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.vendorProducts.table.product', 'Product Entity')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.vendorProducts.table.inventory', 'Inventory/Price')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest">{t('admin.vendorProducts.table.state', 'Lifecycle State')}</th>
                  <th className="px-8 py-5 text-[10px] font-black text-gray-400 uppercase tracking-widest text-end">{t('admin.vendorProducts.table.actions', 'Governance Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((product) => {
                  const images = typeof product.images === 'string' ? JSON.parse(product.images || '[]') : product.images;
                  const mainImage = images[0] || '/imgs/default-product.jpg';

                  return (
                    <tr key={product.id} className="hover:bg-gray-50/50 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100 shadow-sm">
                            <img src={getImageUrl(mainImage)} alt={product.name} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">{product.name}</p>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1">{product.sku}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className="text-[9px] font-black uppercase px-2.5 py-1 bg-gray-100 text-gray-500 rounded-lg">
                                {product.category?.name || t('common.uncategorized', 'Uncategorized')}
                              </span>
                            </div>
                          </div>
                        </div>
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
                          {product.stock} {t('admin.vendorProducts.inEcosystem', 'in Ecosystem')}
                        </p>
                      </td>
                      <td className="px-8 py-6">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${(product.status === 'APPROVED' || product.status === 'ACTIVE') ? 'bg-green-100 text-green-700' :
                            product.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                              product.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                product.status === 'INACTIVE' ? 'bg-gray-100 text-gray-500' :
                                  'bg-gray-100 text-gray-700'
                          }`}>
                          {mapEnum(productStatusMap, product.status)}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-end">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {canUpdate && (
                            <button
                              onClick={() => handleOpenModal(product)}
                              className="p-3 text-blue-500 hover:bg-blue-50 rounded-2xl transition-all"
                              title={t('common.edit', 'Edit')}
                            >
                              <FiEdit2 style={{ width: 18, height: 18 }} />
                            </button>
                          )}
                          {canUpdate && product.status !== 'APPROVED' && product.status !== 'ACTIVE' && (
                            <button
                              onClick={() => handleStatusUpdate(product.id, 'APPROVED')}
                              className="p-3 text-green-500 hover:bg-green-50 rounded-2xl transition-all"
                              title={t('admin.vendorProducts.approve', 'Approve')}
                            >
                              <FiCheckCircle />
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

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-8 py-6 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                {t('admin.vendorProducts.pagination', { current: pagination.page, total: pagination.totalPages })}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-30 active:scale-95"
                >
                  {t('common.prev', 'Prev')}
                </button>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="px-6 py-3 bg-white border border-gray-200 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-30 active:scale-95"
                >
                  {t('common.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in duration-300">
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-black text-gray-900 uppercase">{editingProduct ? t('admin.vendorProducts.editTitle', 'Edit Product Entry') : t('admin.vendorProducts.createTitle', 'Register New Product')}</h2>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">{t('admin.vendorProducts.modalSubtitle', 'Catalog Governance Form')}</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-3 hover:bg-white rounded-2xl transition-all group">
                <FiX className="text-gray-400 group-hover:text-red-500" style={{ width: 24, height: 24 }} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Basic Info */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.name', 'Product Name')}</label>
                    <input
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      placeholder={t('common.placeholder.name', 'Enter product title...')}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.description', 'Description')}</label>
                    <textarea
                      rows={4}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all resize-none"
                      placeholder={t('common.placeholder.description', 'Technical specifications and details...')}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.price', 'Base Price')}</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.price}
                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.stock', 'Inventory Count')}</label>
                      <input
                        type="number"
                        required
                        value={formData.stock}
                        onChange={e => setFormData({ ...formData, stock: e.target.value })}
                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Discount Section */}
                  <div className="p-6 bg-blue-50/50 rounded-3xl border border-blue-100/50 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">{t('admin.vendorProducts.discountTitle', 'Promotional Strategy')}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.discountType', 'Discount Type')}</label>
                        <select
                          value={formData.discountType}
                          onChange={e => setFormData({ ...formData, discountType: e.target.value })}
                          className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                        >
                          <option value="">{t('common.noDiscount', 'No Discount')}</option>
                          <option value="PERCENTAGE">{t('common.percentage', 'Percentage (%)')}</option>
                          <option value="FIXED">{t('common.fixed', 'Fixed Amount')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.discountValue', 'Discount Value')}</label>
                        <input
                          type="number"
                          disabled={!formData.discountType}
                          value={formData.discountValue}
                          onChange={e => setFormData({ ...formData, discountValue: e.target.value })}
                          className="w-full bg-white border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all disabled:opacity-30"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.finalPrice', 'Calculated Final Price')}</label>
                      <div className="w-full bg-white border border-primary-500/30 rounded-2xl px-5 py-4 text-sm font-black text-primary-600 shadow-sm shadow-primary-500/5">
                        {formData.discountPrice ? formatPrice(parseFloat(formData.discountPrice)) : formatPrice(parseFloat(formData.price) || 0)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Categorization & Images */}
                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.category', 'Master Category')}</label>
                    <select
                      required
                      value={formData.categoryId}
                      onChange={e => setFormData({ ...formData, categoryId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                    >
                      <option value="">{t('common.select', 'Select Category')}</option>
                      {Array.isArray(categories) && categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 ms-1">{t('common.brand', 'Associated Brand')}</label>
                    <select
                      value={formData.brandId}
                      onChange={e => setFormData({ ...formData, brandId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-5 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all appearance-none"
                    >
                      <option value="">{t('common.none', 'None')}</option>
                      {Array.isArray(brands) && brands.map(brand => (
                        <option key={brand.id} value={brand.id}>{brand.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Premium Image Uploader Integration */}
                  <div className="bg-gray-50/50 p-6 rounded-3xl border border-gray-100 border-dashed">
                    <ImageUploader
                      multiple={true}
                      value={formData.images}
                      onChange={(items: (File | string)[]) => setFormData({ ...formData, images: items })}
                      label={t('common.images', 'Visual Assets')}
                      helperText={t('admin.vendorProducts.imageHelper', 'Upload high-quality local files or link external assets')}
                    />
                  </div>
                </div>
              </div>
            </form>

            <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-8 py-4 text-xs font-black text-gray-500 uppercase tracking-widest hover:text-gray-900 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-4 bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all disabled:opacity-50 active:scale-95 shadow-xl hover:shadow-primary-500/30"
              >
                {submitting ? t('common.saving', 'Processing...') : (editingProduct ? t('common.save', 'Commit Changes') : t('common.create', 'Establish Entry'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProductsPage;