import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { FiPlusCircle, FiEdit2, FiTrash } from 'react-icons/fi';

interface Category {
  id: string;
  name: string;
  nameAr?: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  parentId?: string;
  parent?: Category;
  children?: Category[];
}

const AdminCategoriesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    image: '',
    parentId: '',
    orderIndex: 0,
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/admin/categories');
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up data - remove empty parentId
      const dataToSend = {
        ...formData,
        parentId: formData.parentId || null,
      };

      if (editingCategory) {
        await api.patch(`/admin/categories/${editingCategory.id}`, dataToSend);
        toast.success(t('messages.updateSuccess'));
      } else {
        await api.post('/admin/categories', dataToSend);
        toast.success(t('messages.addSuccess'));
      }
      fetchCategories();
      resetForm();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save category');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('messages.confirmDelete', 'Are you sure you want to delete this category?'))) return;

    try {
      await api.delete(`/admin/categories/${id}`);
      toast.success(t('messages.deleteSuccess'));
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      image: '',
      parentId: '',
      orderIndex: 0,
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      nameAr: category.nameAr || '',
      description: category.description || '',
      descriptionAr: category.descriptionAr || '',
      image: '',
      parentId: category.parentId || '',
      orderIndex: 0,
    });
    setShowForm(true);
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading', 'Loading categories...')}</div>;
  }

  const topLevelCategories = categories.filter((c) => !c.parentId);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('admin.categories')}</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <FiPlusCircle className="w-5 h-5" />
          <span>{t('admin.addCategory')}</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingCategory ? t('admin.editCategory') : t('admin.addCategory')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* English Name */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.categoryName')} ({t('common.english', 'English')}) *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  required
                  placeholder={t('admin.categoriesPage.placeholder.nameEn', 'Category name in English')}
                />
              </div>
              {/* Arabic Name */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.categoryName')} ({t('common.arabic', 'العربية')})
                </label>
                <input
                  type="text"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="input-field"
                  dir="rtl"
                  placeholder={t('admin.categoriesPage.placeholder.nameAr', 'اسم الفئة بالعربية')}
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.categoryDescription')} ({t('common.english', 'English')})
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder={t('admin.categoriesPage.placeholder.descEn', 'Description in English')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  {t('admin.categoryDescription')} ({t('common.arabic', 'العربية')})
                </label>
                <textarea
                  value={formData.descriptionAr}
                  onChange={(e) => setFormData({ ...formData, descriptionAr: e.target.value })}
                  className="input-field"
                  rows={3}
                  dir="rtl"
                  placeholder={t('admin.categoriesPage.placeholder.descAr', 'الوصف بالعربية')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('admin.parentCategory')}</label>
              <select
                value={formData.parentId}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                className="input-field"
              >
                <option value="">{t('admin.categoriesPage.noneLevel', 'None (Top Level)')}</option>
                {topLevelCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {isRTL && cat.nameAr ? cat.nameAr : cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-4">
              <button type="submit" className="btn-primary">
                {editingCategory ? t('common.save') : t('common.add')}
              </button>
              <button type="button" onClick={resetForm} className="btn-outline">
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('admin.categoryName')} (EN)
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('admin.categoryName')} ({t('common.arabic', 'AR')})
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">{t('admin.slug', 'Slug')}</th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('admin.parentCategory')}
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('common.edit')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {categories.map((category) => (
              <tr key={category.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{category.name}</td>
                <td className="px-6 py-4 font-medium" dir="rtl">{category.nameAr || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">/{category.slug}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {category.parent ? (isRTL && category.parent.nameAr ? category.parent.nameAr : category.parent.name) : '-'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(category)}
                      className="p-2 text-primary-500 hover:bg-primary-50 rounded"
                      title={t('common.edit')}
                    >
                      <FiEdit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded"
                      title={t('common.delete')}
                    >
                      <FiTrash className="w-5 h-5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCategoriesPage;

