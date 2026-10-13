import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { formatPrice } from '../../lib/utils';
import { getImageUrl } from '../../utils/image';
import { getVariantImageAlt } from '../../utils/imageAlt';
import { StudioVariant } from './studioModel';
import { getVariantAvailability } from './variantModel';

export interface VariantListProps {
  variants: StudioVariant[];
  busyKey: string | null;
  productName: { name: string; nameAr: string };
  /** Server errors for create-mode variants, keyed by their position in the full list. */
  errorFor: (variant: StudioVariant) => string | undefined;
  onEdit: (variant: StudioVariant) => void;
  onSetDefault: (variant: StudioVariant) => void;
  onToggleStatus: (variant: StudioVariant) => void;
  onDelete: (variant: StudioVariant) => void;
}

const Badge: React.FC<{ tone: 'primary' | 'gray' | 'amber' | 'green'; children: React.ReactNode }> = ({ tone, children }) => {
  const tones = {
    primary: 'bg-primary-50 text-primary-700 border-primary-200',
    gray: 'bg-gray-100 text-gray-600 border-gray-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    green: 'bg-green-50 text-green-700 border-green-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
};

const useVariantParts = (
  { busyKey, productName, onEdit, onSetDefault, onToggleStatus, onDelete }: VariantListProps,
  scope: 'table' | 'cards',
) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const label = (v: StudioVariant) => (isRTL && v.nameAr ? v.nameAr : v.name);
  const secondaryLabel = (v: StudioVariant) => (isRTL ? (v.nameAr ? v.name : '') : v.nameAr);

  const attributes = (v: StudioVariant) => (
    <ul className="flex flex-wrap gap-1">
      {v.attributes.map((a, i) => (
        <li key={`${a.name}-${i}`} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          <span className="text-gray-500">{(isRTL && a.nameAr) || a.name}:</span> {(isRTL && a.valueAr) || a.value}
        </li>
      ))}
    </ul>
  );

  const availabilityBadge = (v: StudioVariant) => {
    const state = getVariantAvailability(v);
    if (state === 'inactive') return <Badge tone="gray">{t('common.inactive', 'Inactive')}</Badge>;
    if (state === 'outOfStock') return <Badge tone="amber">{t('productStudio.variants.outOfStock', 'Out of stock')}</Badge>;
    return <Badge tone="green">{t('productStudio.variants.available', 'Available')}</Badge>;
  };

  const badges = (v: StudioVariant) => (
    <span className="flex flex-wrap gap-1">
      {v.status && v.isDefault && <Badge tone="primary">{t('productStudio.variants.colDefault', 'Default')}</Badge>}
      {v.discountPrice != null && v.discountPrice > 0 && <Badge tone="gray">{t('productStudio.variants.discounted', 'Discounted')}</Badge>}
    </span>
  );

  const defaultControl = (v: StudioVariant) => (
    <input
      type="radio"
      name={`studio-default-variant-${scope}`}
      checked={v.status && v.isDefault}
      disabled={!v.status || !!busyKey}
      onChange={() => onSetDefault(v)}
      className="w-5 h-5 accent-primary-600 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
      aria-label={t('productStudio.variants.setDefaultNamed', 'Default variant: {{name}}', { name: label(v) })}
      title={v.status ? undefined : t('productStudio.variants.inactiveNoDefault', 'Inactive variants cannot be the default.')}
    />
  );

  const statusControl = (v: StudioVariant) => (
    <button
      type="button"
      role="switch"
      aria-checked={v.status}
      disabled={!!busyKey}
      onClick={() => onToggleStatus(v)}
      className="inline-flex items-center gap-2 rounded-md px-1 py-1 text-xs font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      aria-label={v.status
        ? t('productStudio.variants.deactivateNamed', 'Deactivate {{name}}', { name: label(v) })
        : t('productStudio.variants.activateNamed', 'Activate {{name}}', { name: label(v) })}
    >
      <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${v.status ? 'bg-primary-600' : 'bg-gray-300'}`} aria-hidden="true">
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${v.status ? 'start-[1.125rem]' : 'start-0.5'}`} />
      </span>
      <span className={v.status ? 'text-gray-800' : 'text-gray-500'}>{v.status ? t('common.active', 'Active') : t('common.inactive', 'Inactive')}</span>
    </button>
  );

  const actions = (v: StudioVariant) => (
    <div className="flex items-center gap-1">
      {busyKey === v.clientKey && <Loader2 size={15} className="animate-spin text-gray-400" aria-label={t('common.saving', 'Saving…')} />}
      <button
        type="button"
        onClick={() => onEdit(v)}
        disabled={!!busyKey}
        className="p-2 rounded-md text-gray-700 hover:bg-gray-100 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        aria-label={t('productStudio.variants.editNamed', 'Edit {{name}}', { name: label(v) })}
        title={t('common.edit', 'Edit')}
      >
        <Pencil size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => onDelete(v)}
        disabled={!!busyKey}
        className="p-2 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        aria-label={t('productStudio.variants.deleteNamed', 'Delete {{name}}', { name: label(v) })}
        title={t('common.delete', 'Delete')}
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );

  const thumb = (v: StudioVariant, size: string) => (
    v.image ? (
      <img src={getImageUrl(v.image)} alt={getVariantImageAlt(v, productName, isRTL)} loading="lazy" className={`${size} rounded-lg object-cover border border-gray-200 shrink-0`} />
    ) : (
      <span className={`${size} rounded-lg bg-gray-100 border border-dashed border-gray-200 inline-block shrink-0`} aria-hidden="true" />
    )
  );

  const sku = (v: StudioVariant) => v.sku || <span className="text-gray-400">{t('productStudio.variants.skuAuto', 'Auto')}</span>;
  const discount = (v: StudioVariant) => (v.discountPrice ? <span className="font-semibold text-primary-700">{formatPrice(v.discountPrice)}</span> : <span className="text-gray-400">—</span>);

  return { t, label, secondaryLabel, attributes, availabilityBadge, badges, defaultControl, statusControl, actions, thumb, sku, discount };
};

export const VariantTable: React.FC<VariantListProps> = (props) => {
  const p = useVariantParts(props, 'table');
  const { t } = p;
  return (
    <div className="hidden lg:block overflow-x-auto border-t border-gray-100">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('productStudio.variants.title', 'Variants')}</caption>
        <thead className="bg-gray-50 text-xs text-gray-500">
          <tr>
            <th scope="col" className="px-3 py-2 text-center font-semibold">{t('productStudio.variants.colDefault', 'Default')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colImage', 'Image')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colName', 'Variant')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colAttributes', 'Attributes')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">SKU</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colPrice', 'Price')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colDiscount', 'Discount')}</th>
            <th scope="col" className="px-3 py-2 text-center font-semibold">{t('productStudio.variants.colStock', 'Stock')}</th>
            <th scope="col" className="px-3 py-2 text-start font-semibold">{t('productStudio.variants.colAvailability', 'Availability')}</th>
            <th scope="col" className="px-3 py-2 text-end font-semibold">{t('productStudio.variants.colActions', 'Actions')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {props.variants.map((v) => {
            const error = props.errorFor(v);
            return (
              <tr key={v.clientKey} className={v.status && v.isDefault ? 'bg-primary-50/40' : v.status ? '' : 'bg-gray-50/60'}>
                <td className="px-3 py-2 text-center">{p.defaultControl(v)}</td>
                <td className="px-3 py-2">{p.thumb(v, 'w-10 h-10')}</td>
                <td className="px-3 py-2 min-w-[10rem]">
                  <p className={`font-semibold ${v.status ? 'text-gray-900' : 'text-gray-500'}`}>{p.label(v)}</p>
                  {p.secondaryLabel(v) && <p className="text-xs text-gray-500">{p.secondaryLabel(v)}</p>}
                  <div className="mt-1">{p.badges(v)}</div>
                  {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
                </td>
                <td className="px-3 py-2">{p.attributes(v)}</td>
                <td className="px-3 py-2 font-mono text-xs" dir="ltr">{p.sku(v)}</td>
                <td className="px-3 py-2 font-semibold whitespace-nowrap">{formatPrice(v.price)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{p.discount(v)}</td>
                <td className={`px-3 py-2 text-center font-semibold ${v.stock > 0 ? 'text-gray-900' : 'text-amber-700'}`}>{v.stock}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-col items-start gap-1">
                    {p.availabilityBadge(v)}
                    {p.statusControl(v)}
                  </div>
                </td>
                <td className="px-3 py-2"><div className="flex justify-end">{p.actions(v)}</div></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export const VariantCards: React.FC<VariantListProps> = (props) => {
  const p = useVariantParts(props, 'cards');
  const { t } = p;
  return (
    <ul className="lg:hidden divide-y divide-gray-100 border-t border-gray-100">
      {props.variants.map((v) => {
        const error = props.errorFor(v);
        return (
          <li key={v.clientKey} className={`p-4 space-y-3 ${v.status && v.isDefault ? 'bg-primary-50/40' : ''}`}>
            <div className="flex items-start gap-3">
              {p.thumb(v, 'w-14 h-14')}
              <div className="flex-1 min-w-0 space-y-1">
                <p className={`font-semibold ${v.status ? 'text-gray-900' : 'text-gray-500'}`}>{p.label(v)}</p>
                {p.secondaryLabel(v) && <p className="text-xs text-gray-500">{p.secondaryLabel(v)}</p>}
                <div className="flex flex-wrap gap-1">{p.availabilityBadge(v)}{p.badges(v)}</div>
                {p.attributes(v)}
                {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
              </div>
              {p.actions(v)}
            </div>
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div><dt className="text-gray-500">{t('productStudio.variants.colPrice', 'Price')}</dt><dd className="font-semibold">{formatPrice(v.price)}</dd></div>
              <div><dt className="text-gray-500">{t('productStudio.variants.colDiscount', 'Discount')}</dt><dd>{p.discount(v)}</dd></div>
              <div><dt className="text-gray-500">{t('productStudio.variants.colStock', 'Stock')}</dt><dd className={`font-semibold ${v.stock > 0 ? '' : 'text-amber-700'}`}>{v.stock}</dd></div>
              <div><dt className="text-gray-500">SKU</dt><dd className="font-mono break-all" dir="ltr">{p.sku(v)}</dd></div>
            </dl>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 min-h-[2.25rem]">
                {p.defaultControl(v)} {t('productStudio.variants.colDefault', 'Default')}
              </label>
              {p.statusControl(v)}
            </div>
          </li>
        );
      })}
    </ul>
  );
};
