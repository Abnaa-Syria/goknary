import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';

interface VendorApplyPageProps {
  onApplied?: () => void;
}

const VendorApplyPage: React.FC<VendorApplyPageProps> = ({ onApplied }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    storeName: '',
    description: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
      await api.post('/vendor/apply', formData);
      setSuccess(true);
      setTimeout(() => {
        if (onApplied) onApplied();
        else navigate('/vendor');
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto card p-8 text-center">
          <div className="text-green-500 text-5xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-4">Application Submitted!</h1>
          <p className="text-gray-600">
            Your vendor application has been submitted successfully. We'll review it and notify you once it's approved.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Become a Vendor</h1>

        <div className="card p-6">
          <p className="text-gray-600 mb-6">
            Apply to become a vendor and start selling your products on GoKnary. Fill out the form below and we'll review your application.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-2">
                Store Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="storeName"
                value={formData.storeName}
                onChange={handleChange}
                className="input-field"
                placeholder="My Awesome Store"
                required
              />
              <p className="text-xs text-gray-500 mt-1">This will be your store's public name</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Store Description</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="input-field"
                rows={4}
                placeholder="Tell us about your store..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorApplyPage;

