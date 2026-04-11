import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Trash2, 
  Eye, 
  Search, 
  Filter, 
  MoreVertical,
  MessageSquare,
  User,
  Package,
  Calendar,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector } from '../../store/hooks';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
  };
  product: {
    name: string;
    slug: string;
  };
}

const AdminReviewsPage: React.FC = () => {
  const { t } = useTranslation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    fetchReviews();
  }, [pagination.page]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reviews/admin', {
        params: {
          page: pagination.page,
          limit: pagination.limit
        }
      });
      setReviews(response.data.reviews);
      setPagination(prev => ({
        ...prev,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.totalPages
      }));
    } catch (error: any) {
      console.error('Failed to fetch reviews:', error);
      toast.error('Failed to sync with reviews server');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (id: string) => {
    if (!window.confirm('CRITICAL ACTION: Are you sure you want to delete this review? This will permanently remove it from the product page and recalculate product ratings.')) {
      return;
    }

    try {
      await api.delete(`/reviews/admin/${id}`);
      toast.success('Review moderated successfully');
      fetchReviews();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete review');
    }
  };

  const filteredReviews = reviews.filter(review => 
    review.product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    review.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    review.comment?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star 
            key={s} 
            size={12} 
            className={s <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'} 
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Reviews Moderation</h1>
          <p className="text-gray-500 text-sm mt-1 font-medium">Manage platform-wide feedback and moderate inappropriate content</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 outline-none w-64 transition-all"
            />
          </div>
          <button className="p-2 bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-gray-900 transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-primary-50 text-primary-600 rounded-xl">
            <MessageSquare size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total Reviews</p>
            <p className="text-xl font-black text-gray-900">{pagination.total}</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-yellow-50 text-yellow-600 rounded-xl">
            <Star size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Avg. Rating</p>
            <p className="text-xl font-black text-gray-900">4.8</p>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-600 rounded-xl">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Reported</p>
            <p className="text-xl font-black text-gray-900">0</p>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Review Content</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Product</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Customer</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Date</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`loading-${i}`} className="animate-pulse">
                      <td colSpan={5} className="px-6 py-8">
                        <div className="h-4 bg-gray-100 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-100 rounded w-2/3"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredReviews.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No reviews found matching your search.
                    </td>
                  </tr>
                ) : (
                  filteredReviews.map((review) => (
                    <motion.tr 
                      key={review.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-5 max-w-md">
                        <div className="flex flex-col gap-2">
                          {renderStars(review.rating)}
                          {review.title && <p className="font-black text-gray-900 text-sm">{review.title}</p>}
                          <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed italic">"{review.comment}"</p>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-primary-50 text-primary-600 rounded-lg">
                            <Package size={14} />
                          </div>
                          <span className="text-sm font-bold text-gray-900 max-w-[150px] truncate">{review.product.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                            <User size={14} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900">{review.user.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono tracking-tighter">{review.user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar size={14} />
                          <span className="text-xs font-bold">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-all"
                            title="View Details"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => handleDeleteReview(review.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete Review"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Showing page {pagination.page} of {pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                className="px-3 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminReviewsPage;
