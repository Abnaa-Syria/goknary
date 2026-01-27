import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';
import { FiPlusCircle, FiEdit2, FiTrash, FiCheckCircle, FiXCircle } from 'react-icons/fi';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  discountPrice?: number;
  stock: number;
  status: string;
  images: string[];
  category: {
    name: string;
  };
}

const VendorProductsPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await api.delete(`/vendor/products/${id}`);
      setMessage({ type: 'success', text: 'Product deleted successfully' });
      setTimeout(() => setMessage(null), 3000);
      fetchProducts();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to delete product' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleToggleStatus = async (product: Product) => {
    try {
      const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.patch(`/vendor/products/${product.id}`, { status: newStatus });
      setMessage({ type: 'success', text: `Product ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'} successfully` });
      setTimeout(() => setMessage(null), 3000);
      fetchProducts();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.error || 'Failed to update product status' });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading products...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">My Products</h2>
        <Link to="/vendor/products/new" className="btn-primary flex items-center space-x-2">
          <FiPlusCircle className="w-5 h-5" />
          <span>Add New Product</span>
        </Link>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${
          message.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-700' 
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      {/* Info Banner */}
      {products.some(p => p.status !== 'ACTIVE') && statusFilter === 'all' && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg">
          <p className="text-sm">
            <strong>Note:</strong> Only products with status "ACTIVE" will appear on the website. 
            Products with "DRAFT" or "INACTIVE" status are hidden from customers.
          </p>
        </div>
      )}

      <div className="mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Products</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>

      {products.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500 mb-4">No products found.</p>
          <Link to="/vendor/products/new" className="btn-primary inline-block">
            Add Your First Product
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => {
            const mainImage = product.images?.[0] || '/imgs/default-product.jpg';
            const displayPrice = product.discountPrice || product.price;

            return (
              <div key={product.id} className="card p-4">
                <div className="relative mb-4">
                  <img
                    src={mainImage}
                    alt={product.name}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                  <span
                    className={`absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium ${
                      product.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : product.status === 'DRAFT'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {product.status}
                  </span>
                </div>

                <h3 className="font-medium mb-2 line-clamp-2">{product.name}</h3>
                <p className="text-sm text-gray-500 mb-2">{product.category.name}</p>
                <p className="font-bold mb-2">{formatPrice(displayPrice)}</p>
                <p className="text-sm text-gray-500 mb-4">Stock: {product.stock}</p>

                <div className="flex space-x-2">
                  <Link
                    to={`/vendor/products/${product.id}/edit`}
                    className="flex-1 btn-outline text-sm py-2 flex items-center justify-center space-x-1"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </Link>
                  <button
                    onClick={() => handleToggleStatus(product)}
                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    title={product.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  >
                    {product.status === 'ACTIVE' ? (
                      <FiXCircle className="w-4 h-4" />
                    ) : (
                      <FiCheckCircle className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="px-3 py-2 border border-red-300 text-red-500 rounded-lg hover:bg-red-50"
                  >
                    <FiTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default VendorProductsPage;

