import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { vendorStatusMap, mapEnum } from '../../utils/localization';
import { 
  Eye, 
  Search, 
  Filter, 
  Star, 
  CheckCircle2, 
  XCircle, 
  PauseCircle, 
  Package, 
  Users, 
  Loader2 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatPrice } from '../../lib/utils';

interface Vendor {
  id: string;
  storeName: string;
  slug: string;
  status: string;
  rating: number;
  user: {
    email: string;
    name: string;
  };
  totalSales?: number;
  totalOrders?: number;
  totalProducts?: number;
}

const AdminVendorsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    totalCount: 0
  });

  // Fetch vendors with status and search query params
  const fetchVendors = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: 10
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (searchTerm.trim()) {
        params.q = searchTerm.trim();
      }
      const response = await api.get('/admin/vendors', { params });
      setVendors(response.data.vendors);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.pagination.totalPages,
        totalCount: response.data.pagination.total
      }));
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
      toast.error(t('admin.vendorsPage.loadingFailed', 'Failed to load vendors list'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, pagination.page, searchTerm, t]);

  // Debounced search / filter trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchVendors();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [fetchVendors]);

  // Reset page when filter or search changes
  useEffect(() => {
    setPagination(p => ({ ...p, page: 1 }));
  }, [statusFilter, searchTerm]);

  // Client-side fallback filter so search works instantly in UI even if backend server hasn't been restarted yet
  const displayedVendors = useMemo(() => {
    if (!searchTerm.trim()) return vendors;
    const query = searchTerm.toLowerCase().trim();
    return vendors.filter(vendor => 
      vendor.storeName.toLowerCase().includes(query) ||
      vendor.slug.toLowerCase().includes(query) ||
      vendor.user.name?.toLowerCase().includes(query) ||
      vendor.user.email?.toLowerCase().includes(query)
    );
  }, [vendors, searchTerm]);

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/admin/vendors/${id}/approve`);
      toast.success(t('admin.vendorsPage.approveSuccess', 'Vendor approved successfully'));
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.approveFailed'));
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm(t('admin.vendorsPage.rejectConfirm', 'Are you sure you want to reject this vendor application?'))) return;

    try {
      await api.patch(`/admin/vendors/${id}/reject`);
      toast.success(t('admin.vendorsPage.rejectSuccess', 'Vendor application rejected'));
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.rejectFailed'));
    }
  };

  const handleSuspend = async (id: string) => {
    if (!window.confirm(t('admin.vendorsPage.suspendConfirm', 'Are you sure you want to suspend this vendor store?'))) return;

    try {
      await api.patch(`/admin/vendors/${id}/suspend`);
      toast.success(t('admin.vendorsPage.suspendSuccess', 'Vendor store suspended'));
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.vendorsPage.suspendFailed'));
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-50 text-green-700 border-green-100';
      case 'PENDING':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'REJECTED':
        return 'bg-red-50 text-red-700 border-red-100';
      case 'SUSPENDED':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header section with Stats Summary Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-primary-600 to-primary-700 p-6 rounded-3xl text-white shadow-xl shadow-primary-100/50">
        <div className="flex items-center gap-4">
          <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md">
            <Users size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight">{t('admin.vendorsPage.title', 'Vendors Management')}</h2>
            <p className="text-xs text-white/80 font-bold uppercase tracking-wider mt-0.5">Control & Monitor Store Accounts</p>
          </div>
        </div>
        <div className="bg-white/10 px-5 py-3 rounded-2xl backdrop-blur-md flex items-center gap-3">
          <div className="text-end">
            <p className="text-[10px] text-white/70 font-black uppercase tracking-widest leading-none">Total Vendors</p>
            <p className="text-2xl font-black leading-none mt-1.5">{pagination.totalCount}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative group">
          <Search className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder={t('admin.vendorsPage.searchPlaceholder', 'Search by store name, slug, or owner details...')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full ps-11 pe-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all cursor-pointer"
          >
            <option value="all">{t('admin.vendorsPage.allVendors', 'All Statuses')}</option>
            <option value="PENDING">{t('admin.vendorsPage.pending', 'Pending Approval')}</option>
            <option value="APPROVED">{t('admin.vendorsPage.approved', 'Approved')}</option>
            <option value="REJECTED">{t('admin.vendorsPage.rejected', 'Rejected')}</option>
            <option value="SUSPENDED">{t('admin.vendorsPage.suspended', 'Suspended')}</option>
          </select>

          <button 
            onClick={fetchVendors}
            className="p-2.5 bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center transition-all"
            title="Refresh List"
          >
            <Loader2 className={loading ? 'animate-spin' : ''} size={18} />
          </button>
        </div>
      </div>

      {/* Main Vendor Data Table */}
      {loading && vendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm animate-pulse">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 border-b border-gray-50 flex items-center px-6 gap-8">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-100 rounded w-1/3"></div>
                <div className="h-3 bg-gray-50 rounded w-1/4"></div>
              </div>
              <div className="w-24 h-4 bg-gray-50 rounded"></div>
              <div className="w-20 h-4 bg-gray-50 rounded"></div>
              <div className="w-16 h-8 bg-gray-50 rounded"></div>
            </div>
          ))}
        </div>
      ) : displayedVendors.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <Users className="mx-auto text-gray-300 mb-4" size={48} />
          <h3 className="text-lg font-bold text-gray-800">{t('admin.vendorsPage.noVendorsFound', 'No vendors discovered')}</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Try adjusting your filters or search term to locate the vendor accounts you need.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[900px] border-collapse text-start">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 text-start text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendorsPage.store', 'Store Details')}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendorsPage.owner', 'Owner Details')}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendorsPage.status', 'Status')}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendor.totalSales', 'Total Sales')}</th>
                  <th className="px-6 py-4 text-start text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendorsPage.rating', 'Rating')}</th>
                  <th className="px-6 py-4 text-end text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('admin.vendorsPage.actions', 'Settings')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayedVendors.map((vendor) => (
                  <tr key={vendor.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 text-primary-600 flex items-center justify-center font-black text-sm">
                          {vendor.storeName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-gray-900 leading-none">{vendor.storeName}</span>
                          <span className="text-xs text-gray-400 font-semibold mt-1.5">/{vendor.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-gray-900 leading-none">{vendor.user.name || t('admin.ordersPage.notSpecified', 'Anonymous')}</span>
                        <span className="text-xs text-gray-400 font-medium mt-1">{vendor.user.email}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadgeStyles(vendor.status)}`}>
                        {mapEnum(vendorStatusMap, vendor.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900">
                      {formatPrice(vendor.totalSales || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-medium text-amber-500">
                        <Star className="fill-amber-400 text-amber-400" size={15} />
                        <span className="text-gray-900 text-sm leading-none pt-0.5">{vendor.rating.toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate(`/admin/vendors/${vendor.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors"
                          title={t('admin.vendorsPage.viewDetails', 'View Details')}
                        >
                          <Eye size={18} />
                        </button>

                        <button
                          onClick={() => navigate(`/admin/vendors/${vendor.id}/products`)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-xl transition-colors"
                          title={t('admin.vendorsPage.manageProducts', 'Manage Products')}
                        >
                          <Package size={18} />
                        </button>

                        {vendor.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(vendor.id)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                              title={t('admin.vendorsPage.approve', 'Approve Vendor')}
                            >
                              <CheckCircle2 size={18} />
                            </button>
                            <button
                              onClick={() => handleReject(vendor.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                              title={t('admin.vendorsPage.reject', 'Reject Application')}
                            >
                              <XCircle size={18} />
                            </button>
                          </>
                        )}
                        {vendor.status === 'APPROVED' && (
                          <button
                            onClick={() => handleSuspend(vendor.id)}
                            className="p-2 text-amber-600 hover:bg-amber-50 rounded-xl transition-colors"
                            title={t('admin.vendorsPage.suspend', 'Suspend Account')}
                          >
                            <PauseCircle size={18} />
                          </button>
                        )}
                        {vendor.status === 'SUSPENDED' && (
                          <button
                            onClick={() => handleApprove(vendor.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-xl transition-colors"
                            title={t('admin.vendorsPage.reApprove', 'Activate Account')}
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                {t('admin.vendorsPage.pageOf', { current: pagination.page, total: pagination.totalPages, count: pagination.totalCount }) || `Page ${pagination.page} of ${pagination.totalPages}`}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all shadow-sm"
                >
                  {t('admin.vendorsPage.prev', 'Prev')}
                </button>
                <button
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all shadow-sm"
                >
                  {t('admin.vendorsPage.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminVendorsPage;
