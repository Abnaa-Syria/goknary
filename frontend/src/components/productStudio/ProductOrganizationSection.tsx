import React from 'react';
import { useTranslation } from 'react-i18next';
import { FolderTree } from 'lucide-react';
import CategoryTreeOptions from '../category/CategoryTreeOptions';
import { CategoryLike, findCategoryPath, getCategoryLabel } from '../../utils/categoryTree';
import { StudioField, StudioSection, describedBy, fieldClass } from './StudioSection';
import { FieldErrors, ProductFormState } from './studioModel';

export interface BrandOption {
  id: string;
  name: string;
  nameAr?: string | null;
}

interface Props {
  form: ProductFormState;
  errors: FieldErrors;
  categories: CategoryLike[];
  brands: BrandOption[];
  onChange: (patch: Partial<ProductFormState>) => void;
}

const ProductOrganizationSection: React.FC<Props> = ({ form, errors, categories, brands, onChange }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const path = findCategoryPath(categories, form.categoryId);

  return (
    <StudioSection
      id="studio-organization"
      title={t('productStudio.organization.title', 'Category and brand')}
      subtitle={t('productStudio.organization.subtitle', 'Helps customers find the product while browsing.')}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StudioField
          id="studio-category"
          label={t('productStudio.organization.category', 'Category')}
          required
          error={errors.categoryId}
          hint={t('productStudio.organization.categoryHint', 'Choose the most specific category that fits the product.')}
        >
          <select
            id="studio-category"
            value={form.categoryId}
            onChange={(e) => onChange({ categoryId: e.target.value })}
            className={fieldClass(!!errors.categoryId)}
            aria-invalid={!!errors.categoryId}
            aria-describedby={describedBy('studio-category', errors.categoryId, 'hint')}
          >
            <option value="">{t('productStudio.organization.selectCategory', 'Select a category')}</option>
            <CategoryTreeOptions tree={categories} />
          </select>
          {path.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600">
              <FolderTree size={13} className="text-gray-400" aria-hidden="true" />
              <span className="sr-only">{t('productStudio.organization.selectedPath', 'Selected path')}:</span>
              {path.map((category, index) => (
                <React.Fragment key={category.id}>
                  {index > 0 && <span className="text-gray-300" aria-hidden="true">/</span>}
                  <span className={index === path.length - 1 ? 'font-semibold text-primary-700' : ''}>
                    {getCategoryLabel(category, isRTL)}
                  </span>
                </React.Fragment>
              ))}
            </p>
          )}
        </StudioField>

        <StudioField
          id="studio-brand"
          label={t('productStudio.organization.brand', 'Brand')}
          hint={t('productStudio.organization.brandHint', 'Optional. Choose the brand if the product has one.')}
          error={errors.brandId}
        >
          <select
            id="studio-brand"
            value={form.brandId}
            onChange={(e) => onChange({ brandId: e.target.value })}
            className={fieldClass(!!errors.brandId)}
            aria-invalid={!!errors.brandId}
            aria-describedby={describedBy('studio-brand', errors.brandId, 'hint')}
          >
            <option value="">{t('productStudio.organization.noBrand', 'No brand')}</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {isRTL && brand.nameAr ? brand.nameAr : brand.name}
              </option>
            ))}
          </select>
        </StudioField>
      </div>
    </StudioSection>
  );
};

export default ProductOrganizationSection;
