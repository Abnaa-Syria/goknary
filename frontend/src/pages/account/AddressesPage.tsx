import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Trash2, Edit2, Loader2, Home, Briefcase } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { getGovernorateLabel } from '../../utils/localization';

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

interface ShippingRate {
  id: string;
  governorate: string;
  cost: number;
}

const COUNTRIES = [
  { value: 'Egypt', labelKey: 'account.countryEgypt' },
  { value: 'Saudi Arabia', labelKey: 'account.countrySaudi' },
  { value: 'United Arab Emirates', labelKey: 'account.countryUae' },
  { value: 'Kuwait', labelKey: 'account.countryKuwait' },
  { value: 'Qatar', labelKey: 'account.countryQatar' },
  { value: 'Oman', labelKey: 'account.countryOman' },
  { value: 'Bahrain', labelKey: 'account.countryBahrain' },
  { value: 'Jordan', labelKey: 'account.countryJordan' },
  { value: 'Lebanon', labelKey: 'account.countryLebanon' },
];

const AddressesPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
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
    country: 'Egypt',
    isDefault: false,
  });

  useEffect(() => {
    fetchAddresses();
    api
      .get('/shipping/active')
      .then((res) => setShippingRates(res.data.rates || []))
      .catch(() => {});
  }, []);

  const fetchAddresses = async () => {
    try {
      setLoading(true);
      const response = await api.get('/addresses');
      setAddresses(response.data.addresses);
    } catch {
      toast.error(t('account.addressLoadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.patch(`/addresses/${editingId}`, formData);
        toast.success(t('account.addressUpdated'));
      } else {
        await api.post('/addresses', formData);
        toast.success(t('account.addressAdded'));
      }
      setShowForm(false);
      setEditingId(null);
      fetchAddresses();
    } catch {
      toast.error(t('account.addressSaveFailed'));
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
      isDefault: address.isDefault,
    });
    setEditingId(address.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('account.confirmDeleteAddress'))) return;
    try {
      await api.delete(`/addresses/${id}`);
      toast.success(t('account.addressDeleted'));
      fetchAddresses();
    } catch {
      toast.error(t('account.addressDeleteFailed'));
    }
  };

  const getLabelIcon = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
        return <Home size={16} />;
      case 'office':
      case 'work':
        return <Briefcase size={16} />;
      default:
        return <MapPin size={16} />;
    }
  };

  const getLabelText = (label: string) => {
    switch (label.toLowerCase()) {
      case 'home':
        return t('account.labelHome');
      case 'office':
      case 'work':
        return t('account.labelWork');
      default:
        return t('account.labelOther');
    }
  };

  const resetForm = (isFirstAddress: boolean) => {
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
      isDefault: isFirstAddress,
    });
    setEditingId(null);
    setShowForm(true);
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
            {t('account.myAddresses')}
          </h1>
          <p className="text-sm text-gray-500 mt-1">{t('account.addressesDesc')}</p>
        </div>
        {!showForm && (
          <button
            onClick={() => resetForm(addresses.length === 0)}
            className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
          >
            <Plus size={20} />
            {t('account.addNewAddress')}
          </button>
        )}
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold text-gray-900">
              {editingId ? t('account.editAddress') : t('account.newAddress')}
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              {t('common.cancel')}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.label')}</label>
              <div className="flex flex-wrap gap-3">
                {[
                  { value: 'Home', label: t('account.labelHome') },
                  { value: 'Office', label: t('account.labelWork') },
                  { value: 'Other', label: t('account.labelOther') },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, label: option.value })}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                      formData.label === option.value
                        ? 'bg-primary-50 border-primary-600 text-primary-700 font-bold'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    {getLabelIcon(option.value)}
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.fullName')}</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.phoneNumber')}</label>
              <input
                type="tel"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.addressLine1')}</label>
              <input
                type="text"
                required
                placeholder={t('checkout.streetAddressPlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.addressLine1}
                onChange={(e) => setFormData({ ...formData, addressLine1: e.target.value })}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.addressLine2')}</label>
              <input
                type="text"
                placeholder={t('checkout.apartmentSuitePlaceholder')}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.addressLine2}
                onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.state')}</label>
              <select
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              >
                <option value="">{t('checkout.selectState')}</option>
                {shippingRates.map((rate) => (
                  <option key={rate.id} value={rate.governorate}>
                    {getGovernorateLabel(rate.governorate, i18n.language)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.city')}</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('account.postalCode')}</label>
              <input
                type="text"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">{t('checkout.country')}</label>
              <select
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary-500 transition-all"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.value} value={country.value}>
                    {t(country.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div
                  className={`w-12 h-6 rounded-full transition-all relative ${
                    formData.isDefault ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${
                      formData.isDefault ? 'end-1' : 'start-1'
                    }`}
                  />
                </div>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <span className="text-sm font-bold text-gray-700">{t('account.setAsDefaultShipping')}</span>
              </label>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t border-gray-50">
            <button
              type="submit"
              className="flex-1 bg-gray-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-black transition-all"
            >
              {editingId ? t('account.updateAddress') : t('account.addAddress')}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-4 rounded-xl border border-gray-200 font-bold text-gray-600 hover:bg-gray-50 transition-all"
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {addresses.length === 0 ? (
            <div className="col-span-full bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
              <MapPin size={48} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-bold text-gray-900">{t('account.noAddresses')}</h3>
            </div>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className={`bg-white rounded-2xl p-6 border-2 transition-all relative group ${
                  address.isDefault
                    ? 'border-primary-600 shadow-xl shadow-primary-50'
                    : 'border-gray-100 hover:border-gray-200'
                }`}
              >
                {address.isDefault && (
                  <div className="absolute top-4 end-4 bg-primary-600 text-white text-[10px] font-black uppercase px-2 py-1 rounded-lg">
                    {t('account.default')}
                  </div>
                )}

                <div className="flex items-center gap-2 mb-4 text-primary-700 font-bold">
                  {getLabelIcon(address.label)}
                  <span className="text-sm uppercase tracking-wide">{getLabelText(address.label)}</span>
                </div>

                <div className="space-y-1 mb-6">
                  <h4 className="font-black text-gray-900">{address.fullName}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {address.addressLine1}
                    <br />
                    {address.addressLine2 && (
                      <>
                        {address.addressLine2}
                        <br />
                      </>
                    )}
                    {address.city}, {getGovernorateLabel(address.state, i18n.language)} {address.postalCode}
                    <br />
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
                    {t('common.edit')}
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
