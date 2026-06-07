import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff, 
  Package, 
  Tag, 
  Search,
  Filter,
  ArrowRight,
  ArrowUpRight,
  Upload,
  Layers,
  HelpCircle,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { EmptyState } from '../admin/DashboardComponents';
import { motion, AnimatePresence } from 'framer-motion';
import { getImageUrl } from '../../utils/image';
import { useTranslation } from 'react-i18next';
import { mapEnum, productStatusMap } from '../../utils/localization';  

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  stock: number;
  lowStockThreshold: number;
  status: string;
  images: any; // Can be string or string[]
  category: {
    name: string;
  };
}

const VendorProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Bulk Import modal states
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    fetchProducts();
  }, [statusFilter]);

  useEffect(() => {
    if (importModalOpen) {
      fetchCategories();
    }
  }, [importModalOpen]);

  const fetchProducts = async () => {
    try {
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get('/vendor/products', { params });
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to sync product inventory.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data.categories || response.data || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product? This action cannot be undone.')) return;

    try {
      await api.delete(`/vendor/products/${id}`);
      toast.success('Product removed from catalog.');
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/vendor/products/${product.id}`, { status: newStatus });
      toast.success(`Product is now ${newStatus.toLowerCase()}.`);
      fetchProducts();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update product status');
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importData.trim()) return;

    let parsedProducts = [];
    try {
      parsedProducts = JSON.parse(importData);
      if (!Array.isArray(parsedProducts)) {
        throw new Error('Data must be a JSON array of product objects');
      }
    } catch (err: any) {
      toast.error(`Invalid JSON structure: ${err.message}`);
      return;
    }

    setImporting(true);
    try {
      const response = await api.post('/vendor/products/import', {
        products: parsedProducts
      });

      toast.success(response.data.message || 'Bulk products imported successfully!');
      setImportModalOpen(false);
      setImportData('');
      fetchProducts();
    } catch (error: any) {
      console.error('Bulk import failed:', error);
      toast.error(error.response?.data?.error || 'Failed to import products batch');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 bg-gray-100 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  const sampleImportJSON = JSON.stringify([
    {
      name: "Sample Smart Watch",
      price: 1200,
      stock: 50,
      lowStockThreshold: 10,
      categoryId: "paste_category_id_here",
      description: "Premium fitness smartwatch"
    }
  ], null, 2);

  return (
    <div className="space-y-8 text-start">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('vendor.productsPage.title', 'Product Catalog')}</h1>
          <p className="text-gray-500 mt-1 text-sm">{t('vendor.productsPage.subtitle', 'Manage your inventory, pricing, and visibility.')}</p>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <button
            onClick={() => setImportModalOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-750 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm text-sm"
          >
            <Upload size={16} />
            <span>Bulk Import</span>
          </button>
          
          <Link 
            to="/vendor/products/new" 
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100 whitespace-nowrap text-sm"
          >
            <Plus size={16} />
            <span>{t('vendor.productsPage.addNewProduct', 'Add New Product')}</span>
          </Link>
        </div>
      </div>

      {/* Filters & Tools */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm font-medium focus:outline-none pe-8"
          >
            <option value="all">{t('vendor.productsPage.allStatuses', 'All Statuses')}</option>
            <option value="DRAFT">{t('common.draft', 'Draft')}</option>
            <option value="PENDING">Pending Approval</option>
            <option value="ACTIVE">{t('common.active', 'Active')}</option>
            <option value="INACTIVE">{t('common.inactive', 'Inactive')}</option>
          </select>
        </div>
        
        <div className="relative flex-1 max-w-xs hidden sm:block">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder={t('vendor.productsPage.searchPlaceholder', 'Search my products...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState 
          title={t('vendor.productsPage.noProductsFound', 'No Products Found')} 
          message={t('vendor.productsPage.emptyCatalog', 'Your catalog is currently empty. Start adding products to showcase them to customers.')} 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map((product) => {
            // Normalize images
            let images = [];
            try {
              images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images;
              if (!Array.isArray(images)) images = [];
            } catch (e) {
              images = [];
            }
            
            const mainImage = images[0] || '/imgs/default-product.jpg';
            const hasDiscount = product.discountPrice && product.discountPrice < product.price;
            const discountPercentage = hasDiscount 
              ? Math.round(((product.price - (product.discountPrice as number)) / product.price) * 100)
              : 0;

            const isLowStock = product.stock > 0 && product.stock <= (product.lowStockThreshold || 5);

            return (
              <motion.div 
                key={product.id} 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-100 transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Image Container */}
                  <div className="relative h-56 overflow-hidden bg-gray-50">
                    <img
                      src={getImageUrl(mainImage)}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    
                    {/* Status Badge */}
                    <div className="absolute top-4 start-4 flex flex-wrap gap-2">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                        product.status === 'ACTIVE' || product.status === 'APPROVED'
                          ? 'bg-green-500/90 text-white'
                          : product.status === 'PENDING'
                          ? 'bg-blue-500/90 text-white'
                          : product.status === 'DRAFT'
                          ? 'bg-yellow-555/90 text-white'
                          : 'bg-gray-500/90 text-white'
                      }`}>
                        {mapEnum(productStatusMap, product.status)}
                      </span>
                      
                      {hasDiscount && (
                        <span className="bg-red-500/90 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                          {t('product.discountPercent', { percent: discountPercentage })}
                        </span>
                      )}

                      {isLowStock && (
                        <span className="bg-amber-500/90 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md flex items-center gap-1 animate-pulse">
                          <AlertTriangle size={10} />
                          Low Stock
                        </span>
                      )}
                    </div>

                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button 
                         onClick={() => navigate(`/vendor/products/${product.id}/edit`)}
                         className="p-3 bg-white text-gray-900 rounded-full hover:bg-purple-600 hover:text-white transition-all shadow-lg"
                      >
                        <Edit2 size={20} />
                      </button>
                      <button 
                         onClick={() => handleToggleStatus(product)}
                         className="p-3 bg-white text-gray-900 rounded-full hover:bg-purple-600 hover:text-white transition-all shadow-lg"
                      >
                        {product.status === 'ACTIVE' ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <h3 className="font-bold text-gray-900 line-clamp-2 group-hover:text-purple-600 transition-colors text-sm">
                        {product.name}
                      </h3>
                      <div className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold rounded uppercase flex-shrink-0">
                        {product.category.name}
                      </div>
                    </div>

                    <div className="flex items-end justify-between mt-4">
                      <div className="space-y-1">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">{t('vendor.productsPage.currentPrice', 'Price')}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-black text-gray-900">
                            {formatPrice(hasDiscount ? product.discountPrice! : product.price)}
                          </span>
                          {hasDiscount && (
                            <span className="text-sm text-gray-400 line-through font-medium">
                              {formatPrice(product.price)}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-end">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">{t('vendor.productsPage.availability', 'Availability')}</p>
                        <div className={`flex items-center gap-1.5 mt-1 font-bold text-sm ${
                          product.stock === 0 
                            ? 'text-red-500' 
                            : isLowStock 
                            ? 'text-amber-500' 
                            : 'text-green-600'
                        }`}>
                          <Package size={14} />
                          {product.stock} {t('vendor.productsPage.inStock', 'in stock')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-6 pb-6 pt-0">
                  <div className="pt-6 border-t border-gray-50 flex items-center justify-between">
                    <button 
                      className="text-xs font-bold text-gray-450 hover:text-red-500 transition-colors flex items-center gap-1"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 size={14} />
                      {t('common.remove', 'Remove')}
                    </button>
                    
                    <Link 
                      to={`/vendor/products/${product.id}/edit`}
                      className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      {t('vendor.productsPage.managementDetails', 'Details')}
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Bulk Import Modal */}
      <AnimatePresence>
        {importModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setImportModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10 flex flex-col max-h-[85vh]"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Upload className="text-purple-600" />
                Bulk Product Import
              </h3>
              <p className="text-gray-500 text-xs mb-4">
                Upload products in batch without blocking platform operations. Paste a JSON array matching the catalog schema.
              </p>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
                {/* Category Lookup Helpers */}
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Tag size={12} className="text-purple-500" />
                    Available Category IDs (Copy &amp; Paste in JSON)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-550 max-h-28 overflow-y-auto custom-scrollbar">
                    {categories.map((c) => (
                      <div key={c.id} className="flex justify-between bg-white border border-gray-200/50 p-2 rounded-lg font-mono">
                        <span className="font-sans font-semibold text-gray-700 truncate max-w-[120px]">{c.name}</span>
                        <span className="text-purple-600 select-all cursor-pointer text-[10px]">{c.id}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Main import form */}
                <form onSubmit={handleBulkImport} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-750 uppercase tracking-wider mb-1.5 flex justify-between">
                      <span>JSON Payload Array</span>
                      <button 
                        type="button" 
                        onClick={() => setImportData(sampleImportJSON)}
                        className="text-[10px] text-purple-600 hover:underline font-black normal-case"
                      >
                        Load Sample JSON
                      </button>
                    </label>
                    <textarea
                      rows={8}
                      value={importData}
                      onChange={(e) => setImportData(e.target.value)}
                      required
                      placeholder={`[\n  {\n    "name": "Product Name",\n    "price": 100,\n    "stock": 10,\n    "categoryId": "..."\n  }\n]`}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-xs font-mono transition-all"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={importing}
                      onClick={() => setImportModalOpen(false)}
                      className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-750 font-semibold hover:bg-gray-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={importing || !importData.trim()}
                      className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100 text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {importing ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Importing Batches...
                        </>
                      ) : (
                        <>
                          <Upload size={14} />
                          Submit Import
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VendorProductsPage;
