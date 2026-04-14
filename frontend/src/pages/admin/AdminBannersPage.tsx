import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { FiPlusCircle, FiEdit2, FiTrash } from 'react-icons/fi';
import ImageUploader from '../../components/common/ImageUploader';
import { uploadImages } from '../../utils/upload';
import { getImageUrl } from '../../utils/image';

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
  const { t } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    imageUrl: [] as (File | string)[],
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
      // 1. Process images (Local Files -> URLs)
      const [finalUrl] = await uploadImages(formData.imageUrl);
      
      const payload = {
        ...formData,
        imageUrl: finalUrl || ''
      };

      if (editingBanner) {
        await api.patch(`/admin/banners/${editingBanner.id}`, payload);
        toast.success(t('admin.bannersPage.updateSuccess'));
      } else {
        await api.post('/admin/banners', payload);
        toast.success(t('admin.bannersPage.createSuccess'));
      }
      fetchBanners();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.bannersPage.saveFailed'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.bannersPage.deleteConfirm'))) return;

    try {
      await api.delete(`/admin/banners/${id}`);
      toast.success(t('admin.bannersPage.deleteSuccess'));
      fetchBanners();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.bannersPage.deleteFailed'));
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      imageUrl: [],
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
      imageUrl: banner.imageUrl ? [banner.imageUrl] : [],
      linkUrl: banner.linkUrl || '',
      type: banner.type,
      orderIndex: banner.orderIndex,
      status: banner.status,
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">{t('admin.bannersPage.loading')}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('admin.bannersPage.title')}</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <FiPlusCircle className="w-5 h-5" />
          <span>{t('admin.bannersPage.addBanner')}</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingBanner ? t('admin.bannersPage.editBanner') : t('admin.bannersPage.addNewBanner')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">{t('admin.bannersPage.titleLabel')}</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <ImageUploader 
                label={t('admin.bannersPage.imageAsset')}
                value={formData.imageUrl}
                onChange={(val) => setFormData({ ...formData, imageUrl: val })}
                multiple={false}
                helperText={t('admin.bannersPage.imageHelperText')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">{t('admin.bannersPage.linkUrl')}</label>
              <input
                type="text"
                value={formData.linkUrl}
                onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
                className="input-field"
                placeholder={t('admin.bannersPage.linkUrlPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('admin.bannersPage.typeLabel')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-field"
                >
                  <option value="HERO">{t('admin.bannersPage.typeHero')}</option>
                  <option value="PROMO">{t('admin.bannersPage.typePromo')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('admin.bannersPage.orderIndex')}</label>
                <input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData({ ...formData, orderIndex: parseInt(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.checked })}
                className="w-4 h-4"
              />
              <label className="text-sm font-medium">{t('admin.bannersPage.activeLabel')}</label>
            </div>
            <div className="flex gap-4">
              <button type="submit" className="btn-primary">
                {editingBanner ? t('common.save') : t('common.add')}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline">
                {t('common.cancel')}
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
                src={getImageUrl(banner.imageUrl)}
                alt={banner.title || t('admin.bannersPage.untitled')}
                className="w-full h-full object-cover"
              />
              {!banner.status && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <span className="text-white font-medium">{t('admin.bannersPage.inactiveOverlay')}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium">{banner.title || t('admin.bannersPage.untitled')}</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(banner)}
                  className="p-1 text-primary-500 hover:bg-primary-50 rounded"
                  title={t('common.edit')}
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(banner.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title={t('common.delete')}
                >
                  <FiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-gray-500">
              {banner.type === 'HERO' ? t('admin.bannersPage.typeHero') : t('admin.bannersPage.typePromo')} • {t('admin.bannersPage.orderLabel', { index: banner.orderIndex })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBannersPage;
