import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Trash2, Edit2, Check, Loader2, Home, Briefcase, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

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

const COUNTRIES = [
  "Egypt",
  "Saudi Arabia",
  "United Arab Emirates",
  "Kuwait",
  "Qatar",
  "Oman",
  "Bahrain",
  "Jordan",
  "Lebanon"
];

const AddressesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Egypt', // Default as requested
    isDefault: false
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/addresses');
      setAddresses(response.data.addresses);
    } catch (error) {
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/addresses/${editingId}`, formData);
        toast.success('Address updated');
      } else {
        await api.post('/addresses', formData);
        toast.success('Address added');
      }
      setShowForm(false);
      setEditingId(null);
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to save address');
    }
  };

  const handleEdit = (address: Address) => {
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
      isDefault: address.isDefault
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this address?')) return;
    try {
      await api.delete(`/addresses/${id}`);
      toast.success('Address deleted');
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home': return <Home size={16} />;
      case 'office': 
      case 'work': return <Briefcase size={16} />;
      default: return <MapPin size={16} />;
    }
  };

  if (loading && addresses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
            {t('checkout.shippingAddress')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage your saved addresses for faster checkout</p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
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
                isDefault: addresses.length === 0
              });
              setEditingId(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
          >
            <Plus size={20} />
            Add New Address
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-900">
              {editingId ? 'Edit Address' : 'New Address'}
            </h2>
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Label (e.g. Home, Office)</label>
              <div className="flex gap-3">
                {['Home', 'Office', 'Other'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setFormData({ ...formData, label: l })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                      formData.label === l ? 'bg-primary-50 border-primary-600 text-primary-700 font-bold' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {getLabelIcon(l)}
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number</label>
              <input
                type="tel"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Address Line 1</label>
              <input
                type="text"
                required
                placeholder="Street address, P.O. box, company name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">Address Line 2 (Optional)</label>
              <input
                type="text"
                placeholder="Apartment, suite, unit, building, floor, etc."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">City</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">State / Province</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Postal / Zip Code</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Country</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              >
                {COUNTRIES.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-12 h-6 rounded-full transition-all relative ${formData.isDefault ? 'bg-primary-600' : 'bg-gray-200'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${formData.isDefault ? 'right-1' : 'left-1'}`} />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span className="text-sm font-bold text-gray-700">Set as default shipping address</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-50">
            <button
              type="submit"
              className="flex-1 bg-gray-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-black transition-all"
            >
              {editingId ? 'Save Changes' : 'Add Address'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-4 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {addresses.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">No saved addresses</h3>
              <p className="text-sm text-gray-500">Add an address to speed up your checkout process.</p>
            </div>
          ) : (
            addresses.map((address) => (
              <div 
                key={address.id}
                className={`bg-white rounded-2xl p-6 border-2 transition-all relative group ${
                  address.isDefault ? 'border-primary-600 shadow-xl shadow-primary-50' : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {address.isDefault && (
                  <div className="absolute top-4 right-4 bg-primary-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                    Default
                  </div>
                )}
                
                <div className="flex items-center gap-2 mb-4 text-primary-700 font-bold">
                  {getLabelIcon(address.label)}
                  <span className="text-sm uppercase tracking-wide">{address.label}</span>
                </div>

                <div className="space-y-1 mb-6">
                  <h4 className="font-black text-gray-900">{address.fullName}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {address.addressLine1}<br />
                    {address.addressLine2 && <>{address.addressLine2}<br /></>}
                    {address.city}, {address.state} {address.postalCode}<br />
                    {address.country}
                  </p>
                  <p className="text-sm font-medium text-gray-900 pt-2">{address.phone}</p>
                </div>

                <div className="flex gap-2 pt-4 border-t border-gray-50">
                  <button
                    onClick={() => handleEdit(address)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    <Edit2 size={14} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(address.id)}
                    className="flex items-center justify-center p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all border border-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default AddressesPage;
