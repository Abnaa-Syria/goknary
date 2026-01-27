import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { FiPlusCircle, FiEdit2, FiTrash } from 'react-icons/fi';

interface Brand {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  logo?: string;
  description?: string;
  descriptionAr?: string;
}

const AdminBrandsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    logo: '',
  });

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      const response = await api.get('/admin/brands');
      setBrands(response.data.brands);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBrand) {
        await api.patch(`/admin/brands/${editingBrand.id}`, formData);
      } else {
        await api.post('/admin/brands', formData);
      }
      fetchBrands();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save brand');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('messages.confirmDelete'))) return;

    try {
      await api.delete(`/admin/brands/${id}`);
      fetchBrands();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to delete brand');
    }
  };

  const resetForm = () => {
    setFormData({ name: '', nameAr: '', description: '', descriptionAr: '', logo: '' });
    setEditingBrand(null);
    setShowForm(false);
  };

  const startEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      nameAr: brand.nameAr || '',
      description: brand.description || '',
      descriptionAr: brand.descriptionAr || '',
      logo: brand.logo || '',
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('admin.brands')}</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <FiPlusCircle className="w-5 h-5" />
          <span>{t('admin.addBrand')}</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingBrand ? t('admin.editBrand') : t('admin.addBrand')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Names */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.brandName')} (English) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                  placeholder="Brand name in English"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.brandName')} (العربية)
                </label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="input-field"
                  dir="rtl"
                  placeholder="اسم العلامة التجارية بالعربية"
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Description (English)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Description in English"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Description (العربية)</label>
                <textarea
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  className="input-field"
                  rows={3}
                  dir="rtl"
                  placeholder="الوصف بالعربية"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('admin.brandLogo')} URL</label>
              <input
                type="text"
                value={formData.logo}
                onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                className="input-field"
                placeholder="/imgs/brand-logo.jpg"
              />
            </div>
            <div className="flex gap-4">
              <button type="submit" className="btn-primary">
                {editingBrand ? t('common.save') : t('common.add')}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {brands.map((brand) => (
          <div key={brand.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-medium">{brand.name}</h3>
                {brand.nameAr && (
                  <p className="text-sm text-gray-500" dir="rtl">{brand.nameAr}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(brand)}
                  className="p-1 text-primary-500 hover:bg-primary-50 rounded"
                  title={t('common.edit')}
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(brand.id)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  title={t('common.delete')}
                >
                  <FiTrash className="w-4 h-4" />
                </button>
              </div>
            </div>
            <p className="text-sm text-gray-500">/{brand.slug}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBrandsPage;
