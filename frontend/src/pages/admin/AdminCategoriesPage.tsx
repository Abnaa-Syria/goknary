import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { FiPlusCircle, FiEdit2, FiTrash } from 'react-icons/fi';
import ImageUploader from '../../components/common/ImageUploader';
import CategoryTreeOptions from '../../components/category/CategoryTreeOptions';
import { getRequestErrorMessage, uploadImages } from '../../utils/upload';
import { getImageUrl } from '../../utils/image';
import { CategoryLike, buildCategoryTree, flattenCategoryTree, getCategoryLabel } from '../../utils/categoryTree';

interface Category {
  id: string;
  name: string;
  nameAr?: string | null;
  slug: string;
  description?: string | null;
  descriptionAr?: string | null;
  image?: string | null;
  orderIndex?: number;
  parentId?: string | null;
  parent?: Category | null;
  children?: Category[];
}

const emptyForm = {
  name: '',
  nameAr: '',
  slug: '',
  description: '',
  descriptionAr: '',
  image: [] as (File | string)[],
  parentId: '',
  orderIndex: 0,
};

const AdminCategoriesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(emptyForm);

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

  // The admin API is flat; the page shows and picks parents from the nested tree.
  const tree = useMemo(() => buildCategoryTree(categories.map(({ children: _c, parent: _p, ...c }) => c)), [categories]);
  const rows = useMemo(() => {
    const ordered: Array<{ category: CategoryLike; depth: number }> = flattenCategoryTree<CategoryLike>(tree);
    // Categories caught in a parent loop in old data are unreachable from a root; list them so they can be fixed.
    const seen = new Set(ordered.map((r) => r.category.id));
    categories.filter((c) => !seen.has(c.id)).forEach((c) => ordered.push({ category: c, depth: 0 }));
    return ordered;
  }, [tree, categories]);
  const childCount = useMemo(() => {
    const counts = new Map<string, number>();
    categories.forEach((c) => c.parentId && counts.set(c.parentId, (counts.get(c.parentId) ?? 0) + 1));
    return counts;
  }, [categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const [image] = await uploadImages(formData.image);
      // Every field is pre-filled from the category being edited, so nothing is reset by a save.
      const dataToSend = {
        name: formData.name,
        nameAr: formData.nameAr,
        slug: formData.slug.trim(),
        description: formData.description,
        descriptionAr: formData.descriptionAr,
        image: image || null,
        parentId: formData.parentId || null,
        orderIndex: Number(formData.orderIndex) || 0,
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
      toast.error(getRequestErrorMessage(error, t('common.error', 'Error'), t('common.uploadFailed')));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: Category) => {
    if ((childCount.get(category.id) ?? 0) > 0) {
      toast.error(t('admin.categoriesPage.deleteHasChildren', 'Move or delete its subcategories first'));
      return;
    }
    if (!window.confirm(t('messages.confirmDelete', 'Are you sure you want to delete this category?'))) return;

    try {
      await api.delete(`/admin/categories/${category.id}`);
      toast.success(t('messages.deleteSuccess'));
      fetchCategories();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete category');
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingCategory(null);
    setShowForm(false);
  };

  const startEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      nameAr: category.nameAr || '',
      slug: category.slug,
      description: category.description || '',
      descriptionAr: category.descriptionAr || '',
      image: category.image ? [category.image] : [],
      parentId: category.parentId || '',
      orderIndex: category.orderIndex ?? 0,
    });
    setShowForm(true);
  };

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  if (loading) {
    return <div className="text-center py-8">{t('common.loading', 'Loading categories...')}</div>;
  }

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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('admin.parentCategory')}</label>
                <select
                  value={formData.parentId}
                  onChange={(e) => setFormData({ ...formData, parentId: e.target.value })}
                  className="input-field"
                >
                  <option value="">{t('admin.categoriesPage.noneLevel', 'None (Top Level)')}</option>
                  <CategoryTreeOptions tree={tree} excludeId={editingCategory?.id} />
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('admin.slug', 'Slug')}</label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="input-field"
                  dir="ltr"
                  placeholder={t('admin.categoriesPage.placeholder.slug', 'Generated from the English name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('admin.categoriesPage.orderIndex', 'Display order')}</label>
                <input
                  type="number"
                  value={formData.orderIndex}
                  onChange={(e) => setFormData({ ...formData, orderIndex: Number(e.target.value) })}
                  className="input-field"
                />
              </div>
            </div>

            <ImageUploader
              label={t('admin.categoriesPage.image', 'Category image')}
              value={formData.image}
              onChange={(val) => setFormData({ ...formData, image: val })}
              multiple={false}
            />

            <div className="flex gap-4">
              <button type="submit" className="btn-primary" disabled={saving}>
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
                {t('admin.categoriesPage.orderIndex', 'Display order')}
              </th>
              <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase">
                {t('common.edit')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map(({ category: row, depth }) => {
              const category = byId.get(row.id)!;
              const parent = category.parentId ? byId.get(category.parentId) : undefined;
              return (
                <tr key={category.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">
                    <div className="flex items-center gap-2" style={{ paddingInlineStart: depth * 20 }}>
                      {depth > 0 && <span className="text-gray-300">└</span>}
                      {category.image && (
                        <img src={getImageUrl(category.image)} alt="" className="w-7 h-7 rounded-full object-cover" />
                      )}
                      <span>{category.name}</span>
                      {(childCount.get(category.id) ?? 0) > 0 && (
                        <span className="text-xs text-gray-400">({childCount.get(category.id)})</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium" dir="rtl">{category.nameAr || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">/{category.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{parent ? getCategoryLabel(parent, isRTL) : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">{category.orderIndex ?? 0}</td>
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
                        onClick={() => handleDelete(category)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded"
                        title={t('common.delete')}
                      >
                        <FiTrash className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCategoriesPage;
