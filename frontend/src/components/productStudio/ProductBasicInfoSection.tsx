import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StudioField, StudioSection, describedBy, fieldClass } from './StudioSection';
import { FieldErrors, ProductFormState } from './studioModel';

interface Props {
  form: ProductFormState;
  errors: FieldErrors;
  onChange: (patch: Partial<ProductFormState>) => void;
  onNameChange: (name: string) => void;
  onSlugBlur: () => void;
}

type DescriptionTab = 'ar' | 'en';

const ProductBasicInfoSection: React.FC<Props> = ({ form, errors, onChange, onNameChange, onSlugBlur }) => {
  const { t, i18n } = useTranslation();
  const [tab, setTab] = useState<DescriptionTab>(i18n.language === 'ar' ? 'ar' : 'en');
  const tabs: Array<{ id: DescriptionTab; label: string; filled: boolean }> = [
    { id: 'ar', label: 'العربية', filled: !!form.descriptionAr.trim() },
    { id: 'en', label: 'English', filled: !!form.description.trim() },
  ];

  return (
    <StudioSection
      id="studio-basic"
      title={t('productStudio.basic.title', 'Basic information')}
      subtitle={t('productStudio.basic.subtitle', 'What customers read about the product. The product SKU is created automatically.')}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StudioField
          id="studio-name"
          label={t('productStudio.basic.nameEn', 'Product name (English)')}
          required
          error={errors.name}
          hint={t('productStudio.basic.nameHint', 'The name customers see in the store.')}
        >
          <input
            id="studio-name"
            dir="ltr"
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            className={fieldClass(!!errors.name)}
            aria-invalid={!!errors.name}
            aria-describedby={describedBy('studio-name', errors.name, 'hint')}
            placeholder="e.g. Professional 1200 W Electric Blender"
          />
        </StudioField>
        <StudioField
          id="studio-name-ar"
          label={t('productStudio.basic.nameAr', 'Product name (Arabic)')}
          error={errors.nameAr}
          hint={t('productStudio.basic.nameArHint', 'Shown to customers browsing in Arabic. Recommended.')}
        >
          <input
            id="studio-name-ar"
            dir="rtl"
            value={form.nameAr}
            onChange={(e) => onChange({ nameAr: e.target.value })}
            className={fieldClass(!!errors.nameAr)}
            aria-invalid={!!errors.nameAr}
            aria-describedby={describedBy('studio-name-ar', errors.nameAr, 'hint')}
            placeholder="مثال: خلاط كهربائي احترافي 1200 وات"
          />
        </StudioField>
      </div>

      <StudioField
        id="studio-slug"
        label={t('productStudio.basic.slug', 'Product link (slug)')}
        hint={t('productStudio.basic.slugHint', 'Created automatically from the name; edit it only if needed.')}
        error={errors.slug}
      >
        <div className={`flex items-center rounded-lg border bg-gray-50 ${errors.slug ? 'border-red-400' : 'border-gray-300'}`} dir="ltr">
          <span className="px-3 text-xs text-gray-500 whitespace-nowrap">/product/</span>
          <input
            id="studio-slug"
            value={form.slug}
            onChange={(e) => onChange({ slug: e.target.value })}
            onBlur={onSlugBlur}
            className="flex-1 min-w-0 bg-white rounded-e-lg border-0 border-s border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-invalid={!!errors.slug}
            aria-describedby={describedBy('studio-slug', errors.slug, 'hint')}
          />
        </div>
      </StudioField>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span id="studio-description-label" className="text-sm font-semibold text-gray-800">
            {t('productStudio.basic.description', 'Description')}
          </span>
          <div role="tablist" aria-labelledby="studio-description-label" className="inline-flex rounded-lg bg-gray-100 p-1">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`studio-description-tab-${item.id}`}
                aria-selected={tab === item.id}
                aria-controls={`studio-description-panel-${item.id}`}
                onClick={() => setTab(item.id)}
                className={`px-3 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${tab === item.id ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'}`}
              >
                {item.label}
                <span className={`w-1.5 h-1.5 rounded-full ${item.filled ? 'bg-green-500' : 'bg-gray-300'}`} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
        {tabs.map((item) => (
          <div
            key={item.id}
            role="tabpanel"
            id={`studio-description-panel-${item.id}`}
            aria-labelledby={`studio-description-tab-${item.id}`}
            hidden={tab !== item.id}
          >
            <textarea
              dir={item.id === 'ar' ? 'rtl' : 'ltr'}
              rows={6}
              value={item.id === 'ar' ? form.descriptionAr : form.description}
              onChange={(e) => onChange(item.id === 'ar' ? { descriptionAr: e.target.value } : { description: e.target.value })}
              className={fieldClass(!!errors[item.id === 'ar' ? 'descriptionAr' : 'description'])}
              aria-label={item.id === 'ar'
                ? t('productStudio.basic.descriptionAr', 'Arabic description')
                : t('productStudio.basic.descriptionEn', 'English description')}
              placeholder={item.id === 'ar'
                ? 'مثال: ما هو المنتج، وما الذي يأتي في العلبة، ولمن يناسب.'
                : 'e.g. What the product is, what is in the box, and who it is for.'}
            />
          </div>
        ))}
        <p className="text-xs text-gray-500 mt-1">
          {t('productStudio.basic.plainText', 'Explain what the product is and what makes it useful. Plain text; line breaks are kept.')}
        </p>
      </div>
    </StudioSection>
  );
};

export default ProductBasicInfoSection;
