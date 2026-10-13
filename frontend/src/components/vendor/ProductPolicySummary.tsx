import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FiTruck } from 'react-icons/fi';
import { RotateCcw, Repeat } from 'lucide-react';
import { useAppSelector } from '../../store/hooks';
import { getPolicyText, getReturnWindowDays, PolicyKind, VendorPolicyFields } from '../../lib/vendorPolicies';

interface Props {
  vendor: VendorPolicyFields | null | undefined;
}

/** Product page summary: real vendor policies and platform settings only, no invented terms. */
const ProductPolicySummary: React.FC<Props> = ({ vendor }) => {
  const { t, i18n } = useTranslation();
  const isArabic = i18n.language?.startsWith('ar');
  const { freeShippingThreshold } = useAppSelector((state) => state.settings);
  const [open, setOpen] = useState<PolicyKind | null>(null);

  const returnText = getPolicyText(vendor, 'return', isArabic);
  const shippingText = getPolicyText(vendor, 'shipping', isArabic);
  const exchangeText = getPolicyText(vendor, 'exchange', isArabic);
  const returnWindow = getReturnWindowDays(vendor);

  const toggle = (kind: PolicyKind, label: string) => (
    <button
      type="button"
      onClick={() => setOpen(open === kind ? null : kind)}
      className="text-sm font-medium text-primary-600 hover:text-primary-700"
      aria-expanded={open === kind}
    >
      {open === kind ? t('policies.hidePolicy', 'Hide') : label}
    </button>
  );

  const policyBody = (kind: PolicyKind, text: string | null) =>
    open === kind && text ? (
      <p className="mt-2 text-sm text-gray-600 leading-relaxed whitespace-pre-line break-words">{text}</p>
    ) : null;

  return (
    <>
      <div className="flex items-start gap-3">
        <FiTruck className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-1">{t('policies.shipping', 'Shipping')}</h4>
          {freeShippingThreshold > 0 && (
            <p className="text-sm text-gray-600">{t('home.freeShippingDesc', { amount: freeShippingThreshold })}</p>
          )}
          {shippingText
            ? toggle('shipping', t('policies.viewShippingPolicy', 'View shipping policy'))
            : <Link to="/support/shipping" className="text-sm font-medium text-primary-600 hover:text-primary-700">{t('policies.seePlatformShipping', 'See shipping information')}</Link>}
          {policyBody('shipping', shippingText)}
        </div>
      </div>

      <div className="flex items-start gap-3">
        <RotateCcw className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 mb-1">{t('policies.returns', 'Returns')}</h4>
          {returnWindow !== null && (
            <p className="text-sm text-gray-600">
              {returnWindow === 0
                ? t('policies.noReturns', 'Returns not accepted')
                : t('policies.returnWindow', { count: returnWindow, defaultValue: '{{count}}-day return window' })}
            </p>
          )}
          {returnText
            ? toggle('return', t('policies.viewReturnPolicy', 'View return policy'))
            : <Link to="/support/returns" className="text-sm font-medium text-primary-600 hover:text-primary-700">{t('policies.seePlatformReturns', 'See platform return policy')}</Link>}
          {policyBody('return', returnText)}
        </div>
      </div>

      {exchangeText && (
        <div className="flex items-start gap-3">
          <Repeat className="w-5 h-5 text-primary-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 mb-1">{t('policies.exchange', 'Exchange')}</h4>
            {toggle('exchange', t('policies.viewExchangePolicy', 'View exchange policy'))}
            {policyBody('exchange', exchangeText)}
          </div>
        </div>
      )}
    </>
  );
};

export default ProductPolicySummary;
