import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'lucide-react';
import DiscountSuggestionsPanel from '../../components/discounts/DiscountSuggestionsPanel';

const VendorDiscountSuggestionsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Tag className="h-6 w-6 text-primary-600" />
          {t('discountSuggestions.vendorTitle', 'Smart Discount Suggestions')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t(
            'discountSuggestions.vendorSubtitle',
            'Based on your own store activity. To use a different discount, edit the product instead.'
          )}
        </p>
      </div>
      <DiscountSuggestionsPanel endpoint="/vendor/discount-suggestions" canDecide />
    </div>
  );
};

export default VendorDiscountSuggestionsPage;
