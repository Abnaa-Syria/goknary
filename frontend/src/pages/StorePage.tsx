import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchProducts } from '../store/slices/productSlice';
import ProductCard from '../components/product/ProductCard';
import api from '../lib/api';
import { FiStar } from 'react-icons/fi';

interface Vendor {
  id: string;
  storeName: string;
  slug: string;
  description?: string;
  logo?: string;
  banner?: string;
  rating: number;
  totalReviews: number;
}

const StorePage: React.FC = () => {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const { products, loading, pagination } = useAppSelector((state) => state.products);
  const [vendor, setVendor] = React.useState<Vendor | null>(null);
  const [vendorLoading, setVendorLoading] = React.useState(true);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const response = await api.get(`/vendors/${vendorSlug}`);
        setVendor(response.data);
      } catch (error) {
        console.error('Failed to fetch vendor:', error);
      } finally {
        setVendorLoading(false);
      }
    };

    if (vendorSlug) {
      fetchVendor();
      dispatch(
        fetchProducts({
          vendorId: vendor?.id,
          page: searchParams.get('page') || '1',
        })
      );
    }
  }, [vendorSlug, dispatch]);

  useEffect(() => {
    if (vendor?.id) {
      dispatch(
        fetchProducts({
          vendorId: vendor.id,
          page: searchParams.get('page') || '1',
        })
      );
    }
  }, [vendor?.id, searchParams, dispatch]);

  if (vendorLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading store...</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Store Header */}
      {vendor.banner && (
        <div className="w-full h-64 mb-8 relative overflow-hidden">
          <img
            src={vendor.banner}
            alt={vendor.storeName}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Store Info */}
        <div className="flex items-start space-x-6 mb-8">
          {vendor.logo && (
            <img
              src={vendor.logo}
              alt={vendor.storeName}
              className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold mb-2">{vendor.storeName}</h1>
            <div className="flex items-center space-x-2 mb-2">
              <FiStar className="w-5 h-5 fill-primary-500 text-primary-500" />
              <span className="font-medium">{vendor.rating.toFixed(1)}</span>
              <span className="text-gray-500">({vendor.totalReviews} reviews)</span>
            </div>
            {vendor.description && (
              <p className="text-gray-600 max-w-2xl">{vendor.description}</p>
            )}
          </div>
        </div>

        {/* Products */}
        <div>
          <h2 className="text-2xl font-bold mb-6">Products</h2>
          {loading ? (
            <div className="text-center py-12">Loading products...</div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-8">
                {products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', String(Math.max(1, pagination.page - 1)));
                      window.location.search = newParams.toString();
                    }}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => {
                      const newParams = new URLSearchParams(searchParams);
                      newParams.set('page', String(Math.min(pagination.totalPages, pagination.page + 1)));
                      window.location.search = newParams.toString();
                    }}
                    disabled={pagination.page === pagination.totalPages}
                    className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No products available from this store.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorePage;
