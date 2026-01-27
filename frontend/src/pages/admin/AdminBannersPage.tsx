import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { FiPlusCircle, FiEdit2, FiTrash } from 'react-icons/fi';

interface Banner {
  id: string;
  title?: string;
  imageUrl: string;
  linkUrl?: string;
  type: string;
  status: boolean;
  orderIndex: number;
}

const AdminBannersPage: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: '',
    linkUrl: '',
    type: 'PROMO',
    orderIndex: 0,
    status: true,
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await api.get('/admin/banners');
      setBanners(response.data.banners);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBanner) {
        await api.patch(`/admin/banners/${editingBanner.id}`, formData);
      } else {
        await api.post('/admin/banners', formData);
      }
      fetchBanners();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save banner');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this banner?')) return;

    try {
      await api.delete(`/admin/banners/${id}`);
      fetchBanners();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete banner');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      imageUrl: '',
      linkUrl: '',
      type: 'PROMO',
      orderIndex: 0,
      status: true,
    });
    setEditingBanner(null);
    setShowForm(false);
  };

  const startEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      imageUrl: banner.imageUrl,
      linkUrl: banner.linkUrl || '',
      type: banner.type,
      orderIndex: banner.orderIndex,
      status: banner.status,
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading banners...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Banners</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center space-x-2"
        >
          <FiPlusCircle className="w-5 h-5" />
          <span>Add Banner</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingBanner ? 'Edit Banner' : 'Add New Banner'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Image URL *</label>
              <input
                type="text"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                className="input-field"
                placeholder="/imgs/banner.jpg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Link URL</label>
              <input
                type="text"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                className="input-field"
                placeholder="/category/electronics"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                >
                  <option value="HERO">Hero</option>
                  <option value="PROMO">Promo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Order Index</label>
                <input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">Active</label>
            </div>
            <div className="flex space-x-4">
              <button type="submit" className="btn-primary">
                {editingBanner ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {banners.map((banner) => (
          <div key={banner.id} className="card p-4">
            <div className="relative mb-4 aspect-video rounded-lg overflow-hidden bg-gray-100">
              <img
                src={banner.imageUrl}
                alt={banner.title || 'Banner'}
                className="w-full h-full object-cover"
              />
              {!banner.status && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white font-medium">Inactive</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{banner.title || 'Untitled Banner'}</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => startEdit(banner)}
                  className="p-1 text-primary-500 hover:bg-primary-50 rounded"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                >
                  <FiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">{banner.type} • Order: {banner.orderIndex}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBannersPage;

