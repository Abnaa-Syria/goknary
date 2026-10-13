import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

/**
 * Old per-vendor product list. The admin Product Catalog covers it with a vendor filter, so existing
 * links (vendor directory, vendor details, product preview) land on the catalog filtered to that vendor.
 */
const AdminVendorProductsPage: React.FC = () => {
  const { vendorId } = useParams<{ vendorId: string }>();
  return <Navigate to={vendorId ? `/admin/products?vendorId=${encodeURIComponent(vendorId)}` : '/admin/products'} replace />;
};

export default AdminVendorProductsPage;
