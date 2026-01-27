import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';
import { FiEdit2, FiTrash, FiPlusCircle } from 'react-icons/fi';

interface Address {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

const AddressesPage: React.FC = () => {
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Egypt',
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      const response = await api.get('/addresses');
      setAddresses(response.data.addresses);
    } catch (error) {
      console.error('Failed to fetch addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAddress) {
        await api.patch(`/addresses/${editingAddress.id}`, formData);
      } else {
        await api.post('/addresses', formData);
      }
      fetchAddresses();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || t('messages.errorOccurred'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('account.confirmDeleteAddress'))) return;

    try {
      await api.delete(`/addresses/${id}`);
      fetchAddresses();
    } catch (error: any) {
      alert(error.response?.data?.error || t('messages.errorOccurred'));
    }
  };

  const resetForm = () => {
    setFormData({
      label: 'Home',
      fullName: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Egypt',
      isDefault: false,
    });
    setEditingAddress(null);
    setShowForm(false);
  };

  const startEdit = (address: Address) => {
    setEditingAddress(address);
    setFormData({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state || '',
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault,
    });
    setShowForm(true);
  };

  const getLabelText = (label: string) => {
    switch (label) {
      case 'Home':
        return t('account.labelHome');
      case 'Work':
        return t('account.labelWork');
      case 'Other':
        return t('account.labelOther');
      default:
        return label;
    }
  };

  if (loading) {
    return <div className="text-center py-8">{t('common.loading')}</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">{t('account.myAddresses')}</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <FiPlusCircle className="w-5 h-5" />
          <span>{t('account.addNewAddress')}</span>
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-bold mb-4">
            {editingAddress ? t('account.editAddress') : t('account.addNewAddress')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('account.label')}</label>
                <select
                  name="label"
                  value={formData.label}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="Home">{t('account.labelHome')}</option>
                  <option value="Work">{t('account.labelWork')}</option>
                  <option value="Other">{t('account.labelOther')}</option>
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="isDefault"
                    checked={formData.isDefault}
                    onChange={handleChange}
                    className="w-4 h-4 text-primary-500 rounded"
                  />
                  <span className="text-sm font-medium">{t('account.setAsDefault')}</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('account.fullName')}</label>
              <input
                type="text"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('account.phone')}</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('account.addressLine1')}</label>
              <input
                type="text"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleChange}
                className="input-field"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">{t('account.addressLine2')}</label>
              <input
                type="text"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">{t('account.city')}</label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('account.state')}</label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('account.postalCode')}</label>
                <input
                  type="text"
                  name="postalCode"
                  value={formData.postalCode}
                  onChange={handleChange}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button type="submit" className="btn-primary">
                {editingAddress ? t('account.updateAddress') : t('account.addAddress')}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="btn-outline"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((address) => (
          <div key={address.id} className="card p-4 relative">
            {address.isDefault && (
              <span className="absolute top-2 end-2 bg-primary-500 text-white text-xs px-2 py-1 rounded">
                {t('account.default')}
              </span>
            )}
            <div className="mb-4">
              <h3 className="font-bold text-lg">{getLabelText(address.label)}</h3>
              <p className="text-gray-600">{address.fullName}</p>
              <p className="text-gray-600">{address.phone}</p>
              <p className="text-gray-600">{address.addressLine1}</p>
              {address.addressLine2 && <p className="text-gray-600">{address.addressLine2}</p>}
              <p className="text-gray-600">
                {address.city}
                {address.state && `, ${address.state}`} {address.postalCode}
              </p>
              <p className="text-gray-600">{address.country}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => startEdit(address)}
                className="flex items-center gap-1 text-primary-500 hover:text-primary-600 text-sm"
              >
                <FiEdit2 className="w-4 h-4" />
                <span>{t('common.edit')}</span>
              </button>
              <button
                onClick={() => handleDelete(address.id)}
                className="flex items-center gap-1 text-red-500 hover:text-red-600 text-sm"
              >
                <FiTrash className="w-4 h-4" />
                <span>{t('common.delete')}</span>
              </button>
            </div>
          </div>
        ))}

        {addresses.length === 0 && !showForm && (
          <div className="col-span-2 text-center py-12 text-gray-500">
            {t('account.noAddresses')}
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressesPage;

