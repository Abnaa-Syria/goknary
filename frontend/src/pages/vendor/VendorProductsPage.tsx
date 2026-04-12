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
  ArrowRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { EmptyState } from '../admin/DashboardComponents';
import { motion } from 'framer-motion';
import { getImageUrl } from '../../utils/image';
interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  stock: number;
  status: string;
  images: any; // Can be string or string[]
  category: {
    name: string;
  };
}

const VendorProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, [statusFilter]);

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

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Product Catalog</h1>
          <p className="text-gray-500 mt-1 text-sm">Manage your inventory, pricing, and visibility.</p>
        </div>
        <Link 
          to="/vendor/products/new" 
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-100"
        >
          <Plus size={20} />
          <span>Add New Product</span>
        </Link>
      </div>

      {/* Filters & Tools */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm font-medium focus:outline-none pr-4"
          >
            <option value="all">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        
        <div className="relative flex-1 max-w-xs hidden sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input 
            type="text" 
            placeholder="Search my products..." 
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
        </div>
      </div>

      {products.length === 0 ? (
        <EmptyState 
          title="No Products Found" 
          message="Your catalog is currently empty. Start adding products to showcase them to customers." 
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {products.map((product) => {
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

            return (
              <motion.div 
                key={product.id} 
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-purple-100 transition-all duration-300 overflow-hidden"
              >
                {/* Image Container */}
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={getImageUrl(mainImage)}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${
                      product.status === 'ACTIVE'
                        ? 'bg-green-500/90 text-white'
                        : product.status === 'DRAFT'
                        ? 'bg-yellow-500/90 text-white'
                        : 'bg-gray-500/90 text-white'
                    }`}>
                      {product.status}
                    </span>
                    
                    {hasDiscount && (
                      <span className="bg-red-500/90 text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md">
                        {discountPercentage}% OFF
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
                    <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">
                      {product.name}
                    </h3>
                    <div className="px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-bold rounded uppercase">
                      {product.category.name}
                    </div>
                  </div>

                  <div className="flex items-end justify-between mt-4">
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Current Price</p>
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
                    
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">Availability</p>
                      <div className={`flex items-center gap-1.5 mt-1 font-bold text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        <Package size={14} />
                        {product.stock} in stock
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-gray-50 flex items-center justify-between">
                    <button 
                      className="text-xs font-bold text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1"
                      onClick={() => handleDelete(product.id)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                    
                    <Link 
                      to={`/vendor/products/${product.id}/edit`}
                      className="text-xs font-bold text-purple-600 flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      Management Details
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendorProductsPage;

