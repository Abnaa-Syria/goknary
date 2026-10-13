import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Layers, CheckCircle, AlertTriangle, XCircle, Slash } from 'lucide-react';
import { ProductHubVariantItem } from '../../types/productHub';
import { formatPrice } from '../../lib/utils';

interface ProductVariantsInventoryProps {
  variants: ProductHubVariantItem[];
  productId: string;
  lowStockThreshold: number;
  role: 'admin' | 'vendor';
}

export const ProductVariantsInventory: React.FC<ProductVariantsInventoryProps> = ({
  variants,
  productId,
  lowStockThreshold,
  role,
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const studioUrl = role === 'admin' ? `/admin/products/${productId}/edit` : `/vendor/products/${productId}/edit`;

  const renderStockBadge = (variant: ProductHubVariantItem) => {
    if (!variant.status) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
          <Slash size={11} />
          {t('productHub.variants.inactive', 'Inactive')}
        </span>
      );
    }

    if (variant.stock === 0) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle size={11} />
          {t('productHub.variants.outOfStock', 'Out of Stock')}
        </span>
      );
    }

    if (variant.stock <= lowStockThreshold) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle size={11} />
          {t('productHub.variants.lowStock', 'Low Stock ({{count}} left)', { count: variant.stock })}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle size={11} />
        {t('productHub.variants.inStock', 'In Stock ({{count}})', { count: variant.stock })}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 lg:p-6 shadow-sm mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-5">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Layers size={18} className="text-purple-600" />
            <span>{t('productHub.variants.title', 'Variants & Inventory')}</span>
            <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {variants.length}
            </span>
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('productHub.variants.subtitle', 'Real-time stock status across options and SKU definitions')}
          </p>
        </div>

        <Link
          to={studioUrl}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-sm self-start sm:self-auto"
        >
          <ExternalLink size={13} />
          <span>{t('productHub.variants.editInStudio', 'Edit in Product Studio')}</span>
        </Link>
      </div>

      {variants.length === 0 ? (
        <div className="py-8 text-center text-sm text-gray-400 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
          {t('productHub.variants.noVariants', 'No variants configured for this product. Managing base inventory.')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="py-3 px-3 text-start">{t('productHub.variants.variantCol', 'Variant / Name')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.variants.skuCol', 'SKU')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.variants.attributesCol', 'Attributes')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.variants.priceCol', 'Price')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.variants.stockCol', 'Stock')}</th>
                <th className="py-3 px-3 text-start">{t('productHub.variants.availabilityCol', 'Availability')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {variants.map((variant) => {
                const name = (isRTL && variant.nameAr) || variant.name || '—';
                return (
                  <tr key={variant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {variant.image ? (
                          <img
                            src={variant.image}
                            alt={variant.imageAlt || name}
                            className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0 text-gray-400">
                            <Layers size={14} />
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-gray-900 flex items-center gap-1.5">
                            <span>{name}</span>
                            {variant.isDefault && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                                {t('productHub.variants.defaultBadge', 'Default')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-gray-600 font-medium">
                      {variant.sku || '—'}
                    </td>

                    <td className="py-3 px-3">
                      {variant.attributes && variant.attributes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {variant.attributes.map((attr, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-2 py-0.5 rounded text-[11px] bg-gray-100 text-gray-700"
                            >
                              <span className="text-gray-400 font-normal mr-1">{attr.name}:</span>
                              <span className="font-semibold">{attr.value}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-gray-900">
                        {formatPrice(variant.effectivePrice)}
                      </div>
                      {variant.discountPrice && (
                        <div className="text-[11px] text-gray-400 line-through">
                          {formatPrice(variant.price)}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 font-semibold text-gray-900 tabular-nums">
                      {variant.stock.toLocaleString()}
                    </td>

                    <td className="py-3 px-3">
                      {renderStockBadge(variant)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
