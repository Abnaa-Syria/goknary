import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { FiCheckCircle, FiXCircle, FiPauseCircle, FiPackage } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

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
}

const AdminVendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({ 
    page: 1, 
    totalPages: 1,
    totalCount: 0 
  });

  useEffect(() => {
    fetchVendors();
  }, [statusFilter, pagination.page]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.page,
        limit: 10
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await api.get('/admin/vendors', { params });
      setVendors(response.data.vendors);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.pagination.totalPages,
        totalCount: response.data.pagination.totalCount
      }));
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.patch(`/admin/vendors/${id}/approve`);
      toast.success('Vendor approved successfully');
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to approve vendor');
    }
  };

  const handleReject = async (id: string) => {
    if (!window.confirm('Are you sure you want to reject this vendor?')) return;

    try {
      await api.patch(`/admin/vendors/${id}/reject`);
      toast.success('Vendor rejected');
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to reject vendor');
    }
  };

  const handleSuspend = async (id: string) => {
    if (!window.confirm('Are you sure you want to suspend this vendor?')) return;

    try {
      await api.patch(`/admin/vendors/${id}/suspend`);
      toast.success('Vendor suspended');
      fetchVendors();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to suspend vendor');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return 'bg-green-100 text-green-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'SUSPENDED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading vendors...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Vendors</h2>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Vendors</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
      </div>

      {vendors.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">No vendors found.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Owner</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium">{vendor.storeName}</div>
                    <div className="text-sm text-gray-500">/{vendor.slug}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div>{vendor.user.name || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{vendor.user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vendor.status)}`}>
                      {vendor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-medium">{vendor.rating.toFixed(1)} ⭐</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => navigate(`/admin/vendors/${vendor.id}/products`)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded"
                        title="Manage Master Catalog"
                      >
                        <FiPackage className="w-5 h-5" />
                      </button>
                      
                      {vendor.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(vendor.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                            title="Approve"
                          >
                            <FiCheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(vendor.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <FiXCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                      {vendor.status === 'APPROVED' && (
                        <button
                          onClick={() => handleSuspend(vendor.id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded"
                          title="Suspend"
                        >
                          <FiPauseCircle className="w-5 h-5" />
                        </button>
                      )}
                      {vendor.status === 'SUSPENDED' && (
                        <button
                          onClick={() => handleApprove(vendor.id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded"
                          title="Re-approve"
                        >
                          <FiCheckCircle className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Dashboard Pagination */}
          {pagination.totalPages > 1 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                Showing Page {pagination.page} of {pagination.totalPages} ({pagination.totalCount} Total)
              </p>
              <div className="flex gap-2">
                <button 
                  disabled={pagination.page === 1}
                  onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                >
                  Prev
                </button>
                <button 
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                  className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                >
                  Next
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

