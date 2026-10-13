import React from 'react';
import { useTranslation } from 'react-i18next';
import { RotateCcw, Truck, Repeat } from 'lucide-react';
import { getPolicyText, getReturnWindowDays, PolicyKind, POLICY_KINDS, VendorPolicyFields } from '../../lib/vendorPolicies';

const ICONS: Record<PolicyKind, React.ElementType> = { return: RotateCcw, shipping: Truck, exchange: Repeat };
const TITLE_KEYS: Record<PolicyKind, [string, string]> = {
  return: ['policies.returnPolicy', 'Return Policy'],
  shipping: ['policies.shippingPolicy', 'Shipping Policy'],
  exchange: ['policies.exchangePolicy', 'Exchange Policy'],
};

interface StorePoliciesProps {
  vendor: VendorPolicyFields;
  /** Rendered when the vendor has no policy at all; nothing is rendered by default. */
  emptyState?: React.ReactNode;
}

/** Full policy blocks (store page, admin view). Empty policies are skipped. */
const StorePolicies: React.FC<StorePoliciesProps> = ({ vendor, emptyState = null }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith('ar');
  const returnWindow = getReturnWindowDays(vendor);

  const blocks = POLICY_KINDS
    .map((kind) => ({ kind, text: getPolicyText(vendor, kind, isArabic) }))
    .filter(({ kind, text }) => text || (kind === 'return' && returnWindow !== null));

  if (blocks.length === 0) return <>{emptyState}</>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {blocks.map(({ kind, text }) => {
        const Icon = ICONS[kind];
        return (
          <div key={kind} className="p-5 bg-white border border-gray-200 rounded-xl text-start">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
              <Icon className="w-5 h-5 text-primary-500" />
              {t(...TITLE_KEYS[kind])}
            </h3>
            {kind === 'return' && returnWindow !== null && (
              <p className="text-sm font-semibold text-primary-700 mb-2">
                {returnWindow === 0
                  ? t('policies.noReturns', 'Returns not accepted')
                  : t('policies.returnWindow', { count: returnWindow, defaultValue: '{{count}}-day return window' })}
              </p>
            )}
            {text && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line break-words">{text}</p>}
          </div>
        );
      })}
    </div>
  );
};

export default StorePolicies;
