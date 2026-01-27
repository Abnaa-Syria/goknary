import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface Vendor {
  id: string;
  storeName: string;
  description?: string;
  logo?: string;
  banner?: string;
}

const VendorSettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
    logo: '',
    banner: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchVendorProfile();
  }, []);

  const fetchVendorProfile = async () => {
    try {
      setLoading(true);
      const response = await api.get('/vendor/me');
      const vendorData = response.data.vendor;
      setVendor(vendorData);
      setFormData({
        storeName: vendorData.storeName || '',
        description: vendorData.description || '',
        logo: vendorData.logo || '',
        banner: vendorData.banner || '',
      });
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load vendor profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      if (!formData.storeName.trim()) {
        setError('Store name is required');
        setLoading(false);
        return;
      }

      const payload: any = {
        storeName: formData.storeName,
        description: formData.description,
      };

      // Only include logo/banner if they're provided
      if (formData.logo.trim()) {
        payload.logo = formData.logo;
      }
      if (formData.banner.trim()) {
        payload.banner = formData.banner;
      }

      await api.patch('/vendor/me', payload);
      
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        fetchVendorProfile(); // Refresh data
      }, 2000);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.details?.[0]?.message || 'Failed to update vendor profile';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !vendor) {
    return <div className="text-center py-8">Loading settings...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Vendor Settings</h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          Vendor profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        <div className="space-y-4">
          {/* Store Name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Store Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="storeName"
              value={formData.storeName}
              onChange={handleChange}
              className="input-field w-full"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium mb-2">Store Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="input-field w-full"
              placeholder="Describe your store..."
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-2">Store Logo URL</label>
            <input
              type="text"
              name="logo"
              value={formData.logo}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="https://example.com/logo.jpg"
            />
            {formData.logo && (
              <img
                src={formData.logo}
                alt="Logo preview"
                className="mt-2 w-24 h-24 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>

          {/* Banner */}
          <div>
            <label className="block text-sm font-medium mb-2">Store Banner URL</label>
            <input
              type="text"
              name="banner"
              value={formData.banner}
              onChange={handleChange}
              className="input-field w-full"
              placeholder="https://example.com/banner.jpg"
            />
            {formData.banner && (
              <img
                src={formData.banner}
                alt="Banner preview"
                className="mt-2 w-full max-w-md h-32 object-cover rounded-lg border"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4 pt-4 border-t">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default VendorSettingsPage;

