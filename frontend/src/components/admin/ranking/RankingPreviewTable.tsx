import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Eye, Minus } from 'lucide-react';
import { getImageUrl } from '../../../utils/image';
import { EmptyState } from '../../../pages/admin/DashboardComponents';
import { formatScore, PreviewProduct } from './types';

interface Props {
  products: PreviewProduct[] | null;
  loading: boolean;
  onDetails: (product: PreviewProduct) => void;
}

export const productDisplayName = (product: PreviewProduct, lang: string) =>
  (lang.startsWith('ar') ? product.nameAr || product.name : product.name || product.nameAr) || '—';

export const ScoreChange: React.FC<{ delta: number }> = ({ delta }) => {
  const rounded = Math.round(delta * 10) / 10;
  if (rounded === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500" dir="ltr">
        <Minus size={12} /> 0.0
      </span>
    );
  }
  const up = rounded > 0;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${up ? 'text-emerald-600' : 'text-red-600'}`} dir="ltr">
      {up ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {up ? '+' : ''}
      {rounded.toFixed(1)}
    </span>
  );
};

const RankingPreviewTable: React.FC<Props> = ({ products, loading, onDetails }) => {
  const { t, i18n } = useTranslation();
  const th = 'px-4 py-3 text-start text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap';
  const num = 'px-4 py-3 text-end tabular-nums whitespace-nowrap';

  if (!loading && products && products.length === 0) {
    return <EmptyState title={t('admin.ranking.noProductsTitle', 'No products to rank')} message={t('admin.ranking.noProducts', 'No active products to rank yet.')} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100">
      <table className="w-full text-sm min-w-[820px]">
        <thead className="bg-gray-50 border-b border-gray-100">
          <tr>
            <th className={th}>{t('admin.ranking.rank', 'Rank')}</th>
            <th className={th}>{t('admin.ranking.product', 'Product')}</th>
            <th className={th}>{t('admin.ranking.vendor', 'Vendor')}</th>
            <th className={`${th} text-end`}>{t('admin.ranking.storedScore', 'Stored score')}</th>
            <th className={`${th} text-end`}>{t('admin.ranking.currentScore', 'Current score')}</th>
            <th className={`${th} text-end`}>{t('admin.ranking.previewScore', 'Preview score')}</th>
            <th className={`${th} text-end`}>{t('admin.ranking.change', 'Change')}</th>
            <th className={`${th} text-end`}>
              <span className="sr-only">{t('admin.ranking.details', 'Details')}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-4">
                      <div className={`h-3 rounded bg-gray-100 ${j === 1 ? 'w-40' : 'w-12'}`} />
                    </td>
                  ))}
                </tr>
              ))
            : (products ?? []).map((product) => (
                <tr key={product.productId} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <span className="inline-flex w-7 h-7 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold text-gray-700 tabular-nums">
                      {product.rank}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={getImageUrl(product.image)} alt="" className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate max-w-[16rem]">{productDisplayName(product, i18n.language)}</p>
                        {!product.inStock && (
                          <span className="inline-block mt-0.5 text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            {t('admin.ranking.outOfStock', 'Out of stock')}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{product.vendor?.storeName ?? '—'}</td>
                  <td className={`${num} text-gray-500`}>{formatScore(product.storedScore)}</td>
                  <td className={`${num} text-gray-700`}>{formatScore(product.currentWeightsScore)}</td>
                  <td className={`${num} font-bold text-gray-900`}>{formatScore(product.previewScore)}</td>
                  <td className={num}>
                    <ScoreChange delta={product.previewScore - product.currentWeightsScore} />
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button
                      type="button"
                      onClick={() => onDetails(product)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Eye size={14} /> {t('admin.ranking.viewDetails', 'View details')}
                    </button>
                  </td>
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingPreviewTable;
