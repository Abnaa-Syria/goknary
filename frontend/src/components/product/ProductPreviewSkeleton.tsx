import React from 'react';
import { useTranslation } from 'react-i18next';

/** Layout-shaped placeholder so a preview never flashes "not found" while it loads. */
const ProductPreviewSkeleton: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">{t('productPreview.loading')}</span>
      <div className="h-4 w-48 rounded bg-gray-200 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12">
        <div className="aspect-square rounded-xl bg-gray-200" />
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-8 w-3/4 rounded bg-gray-200" />
          <div className="h-11 w-full rounded-lg bg-gray-100" />
          <div className="h-28 w-full rounded-xl bg-gray-100" />
          <div className="h-20 w-full rounded-xl bg-gray-100" />
        </div>
      </div>
    </div>
  );
};

export default ProductPreviewSkeleton;
