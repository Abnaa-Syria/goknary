import React from 'react';
import { VariantSnapshot } from '../../lib/variants';
import VariantSummary from './VariantSummary';

interface OrderItemVariantProps {
  snapshot: VariantSnapshot | null;
  className?: string;
}

/** Shows the purchase-time variant (name, attributes, SKU). Renders nothing for orders without a snapshot. */
const OrderItemVariant: React.FC<OrderItemVariantProps> = ({ snapshot, className = 'text-xs text-gray-500' }) => (
  <VariantSummary variant={snapshot} sku={snapshot?.sku} className={className} />
);

export default OrderItemVariant;
