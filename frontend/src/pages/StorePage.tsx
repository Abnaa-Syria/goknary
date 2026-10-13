import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import Storefront, { StorefrontVendor } from '../components/vendor/Storefront';

const StorePage: React.FC = () => {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const [vendor, setVendor] = React.useState<StorefrontVendor | null>(null);
  const [vendorLoading, setVendorLoading] = React.useState(true);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const response = await api.get(`/vendors/${vendorSlug}`);
        setVendor(response.data);
      } catch (error) {
        console.error('Failed to fetch vendor:', error);
      } finally {
        setVendorLoading(false);
      }
    };

    if (vendorSlug) {
      fetchVendor();
    }
  }, [vendorSlug]);

  if (vendorLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading store...</div>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Store not found</h1>
        </div>
      </div>
    );
  }

  return <Storefront vendor={vendor} />;
};

export default StorePage;
