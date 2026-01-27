import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

interface Category {
  id: string;
  name: string;
  slug: string;
  children?: Category[];
}

interface Brand {
  id: string;
  name: string;
}

interface VariantAttribute {
  name: string;
  nameAr?: string; // Arabic attribute name
  value: string;
  valueAr?: string; // Arabic attribute value
}

interface ProductVariant {
  id?: string;
  name: string;
  nameAr?: string; // Arabic name
  price: number;
  discountPrice?: number | null;
  stock: number;
  image?: string | null;
  attributes: VariantAttribute[];
  isDefault: boolean;
  status: boolean;
}

const VendorProductFormPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [formData, setFormData] = useState({
    categoryId: '',
    brandId: '',
    name: '',
    nameAr: '', // Arabic name
    description: '',
    descriptionAr: '', // Arabic description
    price: '',
    discountPrice: '',
    stock: '',
    images: [''] as string[],
    featured: false,
    status: 'ACTIVE', // Default to ACTIVE so product appears immediately
    hasVariants: false,
  });
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState<ProductVariant>({
    name: '',
    nameAr: '', // Arabic name
    price: 0,
    discountPrice: null,
    stock: 0,
    image: null,
    attributes: [{ name: '', nameAr: '', value: '', valueAr: '' }],
    isDefault: false,
    status: true,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchCategories();
    fetchBrands();
    if (isEdit) {
      fetchProduct();
    }
  }, [id]);

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await api.get('/brands');
      setBrands(response.data.brands || []);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
      setBrands([]);
    }
  };

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/vendor/products/${id}`);
      const product = response.data;
      
      // Parse images if string
      const images = typeof product.images === 'string' 
        ? JSON.parse(product.images) 
        : product.images || [''];

      setFormData({
        categoryId: product.categoryId || '',
        brandId: product.brandId || '',
        name: product.name || '',
        nameAr: product.nameAr || '',
        description: product.description || '',
        descriptionAr: product.descriptionAr || '',
        price: product.price?.toString() || '',
        discountPrice: product.discountPrice?.toString() || '',
        stock: product.stock?.toString() || '',
        images: images.length > 0 ? images : [''],
        featured: product.featured || false,
        status: product.status || 'DRAFT',
        hasVariants: product.hasVariants || false,
      });

      // Set variants if any
      if (product.variants && product.variants.length > 0) {
        setVariants(product.variants);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleImageChange = (index: number, value: string) => {
    const newImages = [...formData.images];
    newImages[index] = value;
    setFormData({ ...formData, images: newImages });
  };

  const addImageField = () => {
    setFormData({ ...formData, images: [...formData.images, ''] });
  };

  const removeImageField = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    setFormData({ ...formData, images: newImages.length > 0 ? newImages : [''] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Validate
      if (!formData.categoryId || !formData.name || !formData.price || !formData.stock) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
      }

      // Filter out empty image URLs
      const validImages = formData.images.filter(img => img.trim() !== '');
      if (validImages.length === 0) {
        setError('Please add at least one product image');
        setLoading(false);
        return;
      }

      const payload: any = {
        categoryId: formData.categoryId,
        brandId: formData.brandId || undefined,
        name: formData.name,
        nameAr: formData.nameAr || undefined, // Arabic name
        description: formData.description,
        descriptionAr: formData.descriptionAr || undefined, // Arabic description
        price: parseFloat(formData.price),
        discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : undefined,
        stock: parseInt(formData.stock, 10),
        images: validImages,
        featured: formData.featured,
        status: formData.status, // Include status in payload
      };

      // Include variants if creating a new product with variants
      if (!isEdit && variants.length > 0) {
        payload.hasVariants = true;
        payload.variants = variants.map(v => ({
          name: v.name,
          nameAr: v.nameAr || undefined, // Arabic name
          price: v.price,
          discountPrice: v.discountPrice,
          stock: v.stock,
          imageUrl: v.image || undefined,
          attributes: v.attributes,
          isDefault: v.isDefault,
          status: v.status,
        }));
      }

      if (isEdit) {
        await api.patch(`/vendor/products/${id}`, payload);
      } else {
        await api.post('/vendor/products', payload);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate('/vendor/products');
      }, 1500);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.details?.[0]?.message || 'Failed to save product';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Flatten categories for dropdown (include parent and children)
  const getAllCategories = (cats: Category[]): Array<{ id: string; name: string; indent: number }> => {
    const result: Array<{ id: string; name: string; indent: number }> = [];
    cats.forEach(cat => {
      result.push({ id: cat.id, name: cat.name, indent: 0 });
      if (cat.children) {
        cat.children.forEach(child => {
          result.push({ id: child.id, name: `  └ ${child.name}`, indent: 1 });
        });
      }
    });
    return result;
  };

  const flatCategories = getAllCategories(categories);

  if (loading && isEdit) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{isEdit ? t('vendor.editProduct') : t('vendor.addProduct')}</h2>
        <button
          onClick={() => navigate('/vendor/products')}
          className="btn-outline"
        >
          {t('common.cancel')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          {t('messages.saveSuccess')}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Category */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('vendor.productCategory')} <span className="text-red-500">*</span>
            </label>
            <select
              name="categoryId"
              value={formData.categoryId}
              onChange={handleChange}
              className="input-field w-full"
              required
            >
              <option value="">{t('common.all')}</option>
              {flatCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('vendor.productBrand')}</label>
            <select
              name="brandId"
              value={formData.brandId}
              onChange={handleChange}
              className="input-field w-full"
            >
              <option value="">{t('common.none')}</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          {/* Product Name (English) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('vendor.productName')} (English) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="input-field w-full"
              required
              placeholder="Product name in English"
            />
          </div>

          {/* Product Name (Arabic) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('vendor.productName')} (العربية)
            </label>
            <input
              type="text"
              name="nameAr"
              value={formData.nameAr}
              onChange={handleChange}
              className="input-field w-full"
              dir="rtl"
              placeholder="اسم المنتج بالعربية"
            />
          </div>

          {/* Description (English) */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('vendor.productDescription')} (English)</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="input-field w-full"
              rows={4}
              placeholder="Product description in English"
            />
          </div>

          {/* Description (Arabic) */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('vendor.productDescription')} (العربية)</label>
            <textarea
              name="descriptionAr"
              value={formData.descriptionAr}
              onChange={handleChange}
              className="input-field w-full"
              rows={4}
              dir="rtl"
              placeholder="وصف المنتج بالعربية"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium mb-2">
              {t('vendor.productPrice')} ({t('common.currency')}) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="input-field w-full"
              required
            />
          </div>

          {/* Discount Price */}
          <div>
            <label className="block text-sm font-medium mb-2">{t('product.discountPercent', {percent: ''})} ({t('common.currency')})</label>
            <input
              type="number"
              name="discountPrice"
              value={formData.discountPrice}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="input-field w-full"
            />
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Stock Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="stock"
              value={formData.stock}
              onChange={handleChange}
              min="0"
              className="input-field w-full"
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Product Status <span className="text-red-500">*</span>
            </label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="input-field w-full"
              required
            >
              <option value="ACTIVE">Active (Visible on website)</option>
              <option value="DRAFT">Draft (Hidden from website)</option>
              <option value="INACTIVE">Inactive (Hidden from website)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.status === 'ACTIVE' 
                ? '✓ Product will appear on website immediately' 
                : '⚠ Product will be hidden from website'}
            </p>
          </div>

          {/* Featured */}
          <div className="flex items-center">
            <input
              type="checkbox"
              name="featured"
              checked={formData.featured}
              onChange={handleChange}
              id="featured"
              className="w-4 h-4 text-primary-600 rounded"
            />
            <label htmlFor="featured" className="ml-2 text-sm font-medium">
              Featured Product
            </label>
          </div>
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Product Images <span className="text-red-500">*</span>
          </label>
          <p className="text-xs text-gray-500 mb-3">Enter image URLs (one per line)</p>
          {formData.images.map((image, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={image}
                onChange={(e) => handleImageChange(index, e.target.value)}
                placeholder={`Image URL ${index + 1}`}
                className="input-field flex-1"
              />
              {formData.images.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeImageField(index)}
                  className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={addImageField}
            className="btn-outline mt-2"
          >
            + Add Another Image
          </button>
        </div>

        {/* Product Variants Section */}
        <div className="border-t pt-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold">Product Variants</h3>
                <p className="text-sm text-gray-500">
                  Add variations like different sizes, colors, etc. (Optional)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingVariant(null);
                  setVariantForm({
                    name: '',
                    nameAr: '', // Arabic name
                    price: parseFloat(formData.price) || 0,
                    discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : null,
                    stock: 0,
                    image: null,
                    attributes: [{ name: '', nameAr: '', value: '', valueAr: '' }],
                    isDefault: variants.length === 0,
                    status: true,
                  });
                  setShowVariantForm(true);
                }}
                className="btn-outline"
              >
                + Add Variant
              </button>
            </div>

            {/* Variant Form Modal */}
            {showVariantForm && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
                <h4 className="font-medium mb-4">
                  {editingVariant ? 'Edit Variant' : 'Add New Variant'}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Variant Name - English */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Variant Name (English) *</label>
                    <input
                      type="text"
                      value={variantForm.name}
                      onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })}
                      placeholder="e.g., Red - Large"
                      className="input-field w-full"
                    />
                  </div>
                  
                  {/* Variant Name - Arabic */}
                  <div>
                    <label className="block text-sm font-medium mb-1">Variant Name (العربية)</label>
                    <input
                      type="text"
                      value={variantForm.nameAr || ''}
                      onChange={(e) => setVariantForm({ ...variantForm, nameAr: e.target.value })}
                      placeholder="مثال: أحمر - كبير"
                      className="input-field w-full"
                      dir="rtl"
                    />
                  </div>
                  
                  {/* Attributes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium mb-2">Attributes</label>
                    {variantForm.attributes.map((attr, idx) => (
                      <div key={idx} className="mb-4 p-3 bg-white rounded-lg border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-2">
                          {/* Attribute Name - English */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Attribute Name (English)</label>
                            <input
                              type="text"
                              value={attr.name}
                              onChange={(e) => {
                                const newAttrs = [...variantForm.attributes];
                                newAttrs[idx].name = e.target.value;
                                setVariantForm({ ...variantForm, attributes: newAttrs });
                              }}
                              placeholder="e.g., Color"
                              className="input-field w-full"
                            />
                          </div>
                          {/* Attribute Name - Arabic */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Attribute Name (العربية)</label>
                            <input
                              type="text"
                              value={attr.nameAr || ''}
                              onChange={(e) => {
                                const newAttrs = [...variantForm.attributes];
                                newAttrs[idx].nameAr = e.target.value;
                                setVariantForm({ ...variantForm, attributes: newAttrs });
                              }}
                              placeholder="مثال: اللون"
                              className="input-field w-full"
                              dir="rtl"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Attribute Value - English */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Value (English)</label>
                            <input
                              type="text"
                              value={attr.value}
                              onChange={(e) => {
                                const newAttrs = [...variantForm.attributes];
                                newAttrs[idx].value = e.target.value;
                                setVariantForm({ ...variantForm, attributes: newAttrs });
                              }}
                              placeholder="e.g., Red"
                              className="input-field w-full"
                            />
                          </div>
                          {/* Attribute Value - Arabic */}
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Value (العربية)</label>
                            <input
                              type="text"
                              value={attr.valueAr || ''}
                              onChange={(e) => {
                                const newAttrs = [...variantForm.attributes];
                                newAttrs[idx].valueAr = e.target.value;
                                setVariantForm({ ...variantForm, attributes: newAttrs });
                              }}
                              placeholder="مثال: أحمر"
                              className="input-field w-full"
                              dir="rtl"
                            />
                          </div>
                        </div>
                        {variantForm.attributes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newAttrs = variantForm.attributes.filter((_, i) => i !== idx);
                              setVariantForm({ ...variantForm, attributes: newAttrs });
                            }}
                            className="mt-2 px-3 py-1 text-sm text-red-500 hover:bg-red-50 rounded"
                          >
                            ✕ Remove Attribute
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setVariantForm({
                        ...variantForm,
                        attributes: [...variantForm.attributes, { name: '', nameAr: '', value: '', valueAr: '' }]
                      })}
                      className="text-sm text-primary-600 hover:underline"
                    >
                      + Add Attribute
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Price (EGP) *</label>
                    <input
                      type="number"
                      value={variantForm.price}
                      onChange={(e) => setVariantForm({ ...variantForm, price: parseFloat(e.target.value) || 0 })}
                      step="0.01"
                      min="0"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Discount Price</label>
                    <input
                      type="number"
                      value={variantForm.discountPrice || ''}
                      onChange={(e) => setVariantForm({ ...variantForm, discountPrice: e.target.value ? parseFloat(e.target.value) : null })}
                      step="0.01"
                      min="0"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Stock *</label>
                    <input
                      type="number"
                      value={variantForm.stock}
                      onChange={(e) => setVariantForm({ ...variantForm, stock: parseInt(e.target.value) || 0 })}
                      min="0"
                      className="input-field w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Variant Image URL</label>
                    <input
                      type="text"
                      value={variantForm.image || ''}
                      onChange={(e) => setVariantForm({ ...variantForm, image: e.target.value || null })}
                      placeholder="Optional"
                      className="input-field w-full"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={variantForm.isDefault}
                        onChange={(e) => setVariantForm({ ...variantForm, isDefault: e.target.checked })}
                        className="w-4 h-4 mr-2"
                      />
                      <span className="text-sm">Default Variant</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={variantForm.status}
                        onChange={(e) => setVariantForm({ ...variantForm, status: e.target.checked })}
                        className="w-4 h-4 mr-2"
                      />
                      <span className="text-sm">Active</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const validAttrs = variantForm.attributes.filter(a => a.name && a.value);
                        if (!variantForm.name || validAttrs.length === 0) {
                          alert('Please enter variant name and at least one attribute');
                          return;
                        }
                        
                        const payload = {
                          ...variantForm,
                          attributes: validAttrs,
                        };

                        if (isEdit) {
                          // Edit mode: save via API
                          if (editingVariant?.id) {
                            await api.patch(`/vendor/products/${id}/variants/${editingVariant.id}`, payload);
                          } else {
                            await api.post(`/vendor/products/${id}/variants`, payload);
                          }
                          // Refresh variants from server
                          const res = await api.get(`/vendor/products/${id}/variants`);
                          setVariants(res.data.variants);
                        } else {
                          // Create mode: save locally
                          if (editingVariant) {
                            // Update existing local variant
                            setVariants(variants.map(v => 
                              v === editingVariant ? { ...payload, id: v.id } : v
                            ));
                          } else {
                            // Add new local variant with temporary id
                            const newVariant = {
                              ...payload,
                              id: `temp-${Date.now()}`,
                            };
                            setVariants([...variants, newVariant]);
                          }
                        }
                        setShowVariantForm(false);
                      } catch (err: any) {
                        alert(err.response?.data?.error || 'Failed to save variant');
                      }
                    }}
                    className="btn-primary"
                  >
                    {editingVariant ? 'Update Variant' : 'Add Variant'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowVariantForm(false)}
                    className="btn-outline"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Variants List */}
            {variants.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Attributes</th>
                      <th className="px-3 py-2 text-left">Price</th>
                      <th className="px-3 py-2 text-left">Stock</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {variants.map((v) => (
                      <tr key={v.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          {v.name}
                          {v.isDefault && <span className="ml-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">Default</span>}
                        </td>
                        <td className="px-3 py-2">
                          {v.attributes.map((a, i) => (
                            <span key={i} className="inline-block bg-gray-100 px-2 py-0.5 rounded text-xs mr-1">
                              {a.name}: {a.value}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2">
                          {v.discountPrice ? (
                            <>
                              <span className="line-through text-gray-400 mr-1">EGP {v.price}</span>
                              <span className="text-green-600">EGP {v.discountPrice}</span>
                            </>
                          ) : (
                            `EGP ${v.price}`
                          )}
                        </td>
                        <td className="px-3 py-2">{v.stock}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${v.status ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {v.status ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingVariant(v);
                              setVariantForm(v);
                              setShowVariantForm(true);
                            }}
                            className="text-primary-600 hover:underline mr-2"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('Delete this variant?')) return;
                              try {
                                if (isEdit && v.id && !v.id.startsWith('temp-')) {
                                  await api.delete(`/vendor/products/${id}/variants/${v.id}`);
                                }
                                setVariants(variants.filter(vr => vr.id !== v.id));
                              } catch (err: any) {
                                alert(err.response?.data?.error || 'Failed to delete');
                              }
                            }}
                            className="text-red-600 hover:underline"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {variants.length === 0 && !showVariantForm && (
              <p className="text-gray-500 text-sm text-center py-4 bg-gray-50 rounded">
                No variants added yet. Variants are optional - add them if your product has different sizes, colors, etc.
              </p>
            )}
          </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <button
            type="button"
            onClick={() => navigate('/vendor/products')}
            className="btn-outline"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : isEdit ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VendorProductFormPage;

