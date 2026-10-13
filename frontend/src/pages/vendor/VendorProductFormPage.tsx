import React from 'react';
import { useParams } from 'react-router-dom';
import ProductStudio from '../../components/productStudio/ProductStudio';

const VendorProductFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  return <ProductStudio key={id ?? 'new'} role="vendor" />;
};

export default VendorProductFormPage;
