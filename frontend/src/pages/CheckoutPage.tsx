import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCart, clearCartState } from '../store/slices/cartSlice';
import { formatPrice } from '../lib/utils';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Truck } from 'lucide-react';
import { getImageUrl } from '../utils/image';

interface Address {
  id?: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

interface ShippingRate {
  id: string;
  governorate: string;
  cost: number;
}

const CheckoutPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { appliedPromo } = location.state || {};

  const { items, subtotal, itemCount, loading } = useAppSelector((state) => state.cart);
  const { isAuthenticated: authStatus } = useAppSelector((state) => state.auth);
  
  const [step, setStep] = useState<'address' | 'review'>('address');
  const [submitting, setSubmitting] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);
  
  const [orderNotes, setOrderNotes] = useState('');
  const [address, setAddress] = useState<Address>({
    label: 'Home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Egypt',
  });

  // Load cart, addresses and shipping rates
  useEffect(() => {
    dispatch(fetchCart());
    
    if (authStatus) {
      api.get('/addresses')
        .then(res => setSavedAddresses(res.data.addresses))
        .catch(err => console.error('Error fetching addresses:', err));
      
      api.get('/shipping/active')
        .then(res => setShippingRates(res.data.rates))
        .catch(err => console.error('Error fetching shipping rates:', err));
    }
  }, [dispatch, authStatus]);

  useEffect(() => {
    if (!authStatus) {
      navigate('/login', { state: { from: { pathname: '/checkout' } } });
      return;
    }
  }, [authStatus, navigate]);

  useEffect(() => {
    if (!loading && items.length === 0) {
      navigate('/cart');
    }
  }, [items, loading, navigate]);

  const handleAddressChange = (field: keyof Address, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    
    if (field === 'state') {
      const rate = shippingRates.find(r => r.governorate === value) || null;
      setSelectedRate(rate);
    }
  };

  const selectSavedAddress = (saved: Address) => {
    setAddress({ ...saved });
    const rate = shippingRates.find(r => r.governorate === saved.state) || null;
    setSelectedRate(rate);
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.fullName || !address.phone || !address.addressLine1 || !address.city || !address.postalCode || !address.state) {
      toast.error('Please fill in all required fields');
      return;
    }
    setStep('review');
  };

  const getSessionId = () => {
    let sessionId = localStorage.getItem('cart_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('cart_session_id', sessionId);
    }
    return sessionId;
  };

  const handlePlaceOrder = async () => {
    setSubmitting(true);
    try {
      if (saveAddress && !address.id) {
        try {
          await api.post('/addresses', address);
        } catch (err) {
          console.error('Failed to save address to profile:', err);
        }
      }

      const sessionId = getSessionId();
      const mappedItems = items.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        price: item.discountPrice || item.price,
      }));

      const orderPayload = {
        address,
        shippingMethod: 'Standard',
        couponCode: appliedPromo?.code,
        items: mappedItems,
        notes: orderNotes,
      };

      const response = await api.post('/orders', orderPayload, {
        headers: {
          'x-session-id': sessionId,
        },
      });

      dispatch(clearCartState());
      localStorage.removeItem('cart_session_id');

      const orderId = response.data.orders[0]?.id;
      navigate(`/account/orders/${orderId}?success=true`);
    } catch (error: any) {
      console.error('Error placing order:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to place order.');
      setSubmitting(false);
    }
  };

  const promoDiscount = appliedPromo?.discountAmount || 0;
  const baseShippingCost = selectedRate ? selectedRate.cost : 50;
  const shippingCost = subtotal >= 500 ? 0 : baseShippingCost;
  const total = (subtotal - promoDiscount) + shippingCost;

  if (loading || items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">{t('common.loading')}</div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 font-sans">
      <h1 className="text-3xl font-black mb-8 text-gray-900 tracking-tight">{t('checkout.checkout')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {step === 'address' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Saved Addresses Section */}
              {savedAddresses.length > 0 && (
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 end-0 p-4 opacity-5">
                    <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 9.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-7.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                  </div>
                  <h2 className="text-2xl font-black mb-6 flex items-center gap-3 text-gray-800">
                    <span className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-sm shadow-lg shadow-primary-200">1</span>
                    {t('checkout.savedAddresses')}
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {savedAddresses.map((sa) => (
                      <div 
                        key={sa.id}
                        onClick={() => selectSavedAddress(sa)}
                        className={`p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 relative group ${
                          address.id === sa.id 
                            ? 'border-primary-500 bg-primary-50/50 ring-4 ring-primary-500/5' 
                            : 'border-gray-50 bg-gray-50/40 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase font-black tracking-widest text-primary-600 mb-1">
                              {sa.label === 'Home' ? t('account.labelHome') : sa.label === 'Work' ? t('account.labelWork') : sa.label}
                            </span>
                            <span className="font-bold text-gray-900">{sa.fullName}</span>
                          </div>
                          {address.id === sa.id && (
                            <div className="bg-primary-600 text-white p-1 rounded-full shadow-md animate-in zoom-in">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-1">{sa.addressLine1}</p>
                        <p className="text-xs text-gray-400 mt-2 font-medium">{sa.phone}</p>
                      </div>
                    ))}
                    <button 
                      onClick={() => setAddress({
                        label: 'Home', fullName: '', phone: '', addressLine1: '', addressLine2: '',
                        city: '', state: '', postalCode: '', country: 'Egypt'
                      })}
                      className="p-5 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 hover:border-primary-300 transition-all text-gray-400 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gray-50 group-hover:bg-primary-50 flex items-center justify-center mb-2 transition-colors">
                        <Plus className="w-6 h-6 group-hover:text-primary-600" />
                      </div>
                      <span className="text-sm font-bold group-hover:text-primary-600 transition-colors">{t('checkout.newAddress')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Address Form */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                <h2 className="text-2xl font-black mb-8 flex items-center gap-3 text-gray-800">
                  <span className="w-10 h-10 rounded-2xl bg-primary-600 text-white flex items-center justify-center text-sm shadow-lg shadow-primary-200">
                    {savedAddresses.length > 0 ? '2' : '1'}
                  </span>
                  {address.id ? t('checkout.refineSelection') : t('checkout.shippingMatrix')}
                </h2>
                <form onSubmit={handleAddressSubmit} className="space-y-6">
                  {/* Row 1: Full Name | Phone */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.fullName')}</label>
                      <input
                        type="text"
                        value={address.fullName}
                        onChange={(e) => handleAddressChange('fullName', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                        placeholder={t('checkout.fullName')}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.phone')}</label>
                      <input
                        type="tel"
                        value={address.phone}
                        onChange={(e) => handleAddressChange('phone', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                        placeholder="+20 1XX XXX XXXX"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 2: Label | Postal Code */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('account.label')}</label>
                      <select
                        value={address.label}
                        onChange={(e) => handleAddressChange('label', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900 appearance-none"
                      >
                        <option value="Home">{t('checkout.labelHomeDesc')}</option>
                        <option value="Work">{t('checkout.labelWorkDesc')}</option>
                        <option value="Other">{t('checkout.labelOtherDesc')}</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.postalCode')}</label>
                      <input
                        type="text"
                        value={address.postalCode}
                        onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                        placeholder="XXXXX"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 3: Street Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.streetAddress')}</label>
                    <input
                      type="text"
                      value={address.addressLine1}
                      onChange={(e) => handleAddressChange('addressLine1', e.target.value)}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                      placeholder={t('checkout.streetAddressPlaceholder')}
                      required
                    />
                  </div>

                  {/* Row 4: Landmark / addressLine2 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.apartmentSuite')}</label>
                    <input
                      type="text"
                      value={address.addressLine2}
                      onChange={(e) => handleAddressChange('addressLine2', e.target.value)}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                      placeholder={t('checkout.apartmentSuitePlaceholder')}
                    />
                  </div>

                  {/* Row 5: Governorate | City */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.state')}</label>
                      <select
                        value={address.state}
                        onChange={(e) => handleAddressChange('state', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900 appearance-none"
                        required
                      >
                        <option value="">{t('checkout.selectState')}</option>
                        {shippingRates.map(rate => (
                          <option key={rate.id} value={rate.governorate}>{rate.governorate}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.city')}</label>
                      <input
                        type="text"
                        value={address.city}
                        onChange={(e) => handleAddressChange('city', e.target.value)}
                        className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900"
                        placeholder="e.g. New Cairo"
                        required
                      />
                    </div>
                  </div>

                  {/* Row 6: Order Notes */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('checkout.deliveryInstructions')}</label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 outline-none transition-all font-medium text-gray-900 resize-none h-24"
                      placeholder={t('checkout.deliveryInstructionsPlaceholder')}
                    />
                  </div>

                  {!address.id && (
                    <div className="flex items-center gap-3 py-2">
                      <input
                        id="save-address"
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-6 h-6 text-primary-600 border-gray-200 rounded-lg focus:ring-primary-500 transition-all cursor-pointer"
                      />
                      <label htmlFor="save-address" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                        {t('checkout.saveToProfile')}
                      </label>
                    </div>
                  )}

                  <div className="flex gap-4 pt-8 border-t border-gray-50 font-bold">
                    <button type="button" onClick={() => navigate('/cart')} className="flex-1 py-4 px-6 border-2 border-gray-100 rounded-2xl text-gray-500 hover:bg-gray-50 active:scale-95 transition-all uppercase tracking-widest text-xs">
                      {t('common.cancel')}
                    </button>
                    <button type="submit" className="flex-1 py-4 px-6 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-200 hover:bg-primary-700 active:scale-95 transition-all uppercase tracking-widest text-xs">
                      {t('checkout.verifyDetails')}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-3xl font-black mb-8 text-gray-900 tracking-tight">{t('checkout.finalVerification')}</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-gray-50/50 rounded-3xl border border-gray-100 relative group overflow-hidden">
                  <div className="absolute top-0 start-0 w-1 h-full bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex justify-between items-center mb-5">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-black tracking-widest text-primary-600 mb-1">
                        {address.label === 'Home' ? t('account.labelHome') : address.label === 'Work' ? t('account.labelWork') : address.label}
                      </span>
                      <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider">{t('checkout.shippingDestination')}</h3>
                    </div>
                    <button onClick={() => setStep('address')} className="text-primary-600 text-xs font-black hover:underline uppercase tracking-widest">
                      {t('common.edit')}
                    </button>
                  </div>
                  <div className="space-y-1.5 text-gray-600 font-medium leading-relaxed">
                    <p className="font-black text-gray-900">{address.fullName}</p>
                    <p className="text-sm">{address.phone}</p>
                    <p className="text-sm">{address.addressLine1}</p>
                    {address.addressLine2 && <p className="text-sm italic">{address.addressLine2}</p>}
                    <p className="text-sm">{address.city}, {address.state} {address.postalCode}</p>
                  </div>
                </div>

                <div className="p-6 bg-gray-50/50 rounded-3xl border border-gray-100">
                  <h3 className="font-bold text-gray-900 uppercase text-xs tracking-wider mb-5">{t('checkout.logisticsProtocol')}</h3>
                  <div className="space-y-5">
                    <div className="flex items-center gap-4 text-gray-700">
                      <div className="w-10 h-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-primary-600 shadow-sm">
                        <Truck className="w-5 h-5 rtl:-scale-x-100" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black">{t('checkout.standardDelivery')}</span>
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">{t('checkout.deliveryTime')}</span>
                      </div>
                    </div>
                    {orderNotes && (
                      <div className="pt-4 border-t border-gray-100">
                        <span className="text-[10px] text-gray-400 uppercase tracking-widest font-black block mb-2">{t('checkout.instructionsLabel')}</span>
                        <p className="text-xs text-gray-600 italic line-clamp-2">"{orderNotes}"</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6 mb-12">
                <h3 className="text-xl font-black text-gray-900 border-b border-gray-50 pb-5">{t('checkout.manifestSummary')}</h3>
                <div className="grid grid-cols-1 gap-4 max-h-[300px] overflow-y-auto pe-2 custom-scrollbar">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-5 p-4 rounded-2xl hover:bg-gray-50 transition-colors">
                      <div className="relative flex-shrink-0">
                        <img 
                          src={getImageUrl(item.product.images?.[0])} 
                          alt={item.product.name} 
                          className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-white" 
                        />
                        <span className="absolute -top-2 -end-2 w-6 h-6 bg-gray-900 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-lg">
                          {item.quantity}
                        </span>
                      </div>
                      <div className="flex flex-col justify-center py-1">
                        <h4 className="font-bold text-gray-900 line-clamp-1">{item.product.name}</h4>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black mt-1">{t('checkout.itemUnitCost')}</p>
                        <p className="font-black text-primary-600 mt-0.5">{formatPrice(item.discountPrice || item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 font-bold">
                <button 
                  onClick={() => setStep('address')} 
                  className="flex-1 py-5 px-6 border-2 border-gray-100 rounded-2xl text-gray-500 hover:bg-gray-50 active:scale-95 transition-all text-xs tracking-widest uppercase font-black"
                >
                  {t('checkout.adjust')}
                </button>
                <button 
                  onClick={handlePlaceOrder} 
                  disabled={submitting} 
                  className="flex-1 py-5 px-6 bg-green-600 text-white rounded-2xl shadow-xl shadow-green-200 hover:bg-green-700 active:scale-95 transition-all flex items-center justify-center gap-3 text-xs tracking-widest uppercase font-black"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                  ) : (
                    <>
                      {t('checkout.placeOrder')}
                      <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-10">
            <div className="bg-white p-8 rounded-[40px] shadow-2xl shadow-gray-200/50 border border-gray-50 relative overflow-hidden">
              <div className="absolute top-0 start-0 w-2 h-full bg-primary-600"></div>
              <h2 className="text-2xl font-black mb-8 text-gray-900 tracking-tight">{t('checkout.orderYield')}</h2>

              <div className="space-y-5 mb-10">
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-gray-400">{t('checkout.totalItems')}</span>
                  <span className="text-sm font-black text-gray-900">{itemCount} {t('checkout.units')}</span>
                </div>
                <div className="flex justify-between items-center px-1">
                  <span className="text-sm font-bold text-gray-400">{t('cart.subtotal')}</span>
                  <span className="text-sm font-black text-gray-900">{formatPrice(subtotal)}</span>
                </div>

                {promoDiscount > 0 && (
                  <div className="flex justify-between items-center bg-green-50/50 p-4 rounded-2xl border border-green-100/50">
                    <span className="text-xs font-black text-green-700 uppercase tracking-widest">{t('checkout.yieldDiscount')} ({appliedPromo?.code})</span>
                    <span className="text-sm font-black text-green-700">-{formatPrice(promoDiscount)}</span>
                  </div>
                )}

                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-400">{t('checkout.logisticsCost')}</span>
                    {selectedRate && <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-500 rounded-lg font-black uppercase tracking-tighter">{selectedRate.governorate}</span>}
                  </div>
                  <span className="text-sm font-black text-gray-900 lowercase italic">
                    {shippingCost === 0 ? <span className="text-green-600 uppercase font-black not-italic tracking-wider">{t('checkout.free')}</span> : formatPrice(shippingCost)}
                  </span>
                </div>
                
                <div className="border-t border-dashed border-gray-100 mt-6 pt-6 flex justify-between items-end px-1">
                  <span className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] mb-1.5">{t('checkout.grandTotal')}</span>
                  <span className="text-3xl font-black text-gray-900 tracking-tighter">{formatPrice(total)}</span>
                </div>
              </div>

              {subtotal < 500 ? (
                <div className="p-4 bg-amber-50 rounded-3xl border border-amber-100/50 flex gap-4 animate-in fade-in zoom-in duration-700">
                  <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-amber-600 text-2xl shadow-sm">🚚</div>
                  <div>
                    <p className="text-[10px] font-black text-amber-800 tracking-widest uppercase mb-1">{t('checkout.freeDeliveryProgress')}</p>
                    <p className="text-[11px] font-medium text-amber-700 leading-relaxed">
                      {t('checkout.freeDeliveryQualify', { amount: formatPrice(500 - subtotal) })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-green-50 rounded-3xl border border-green-100/50 flex gap-4 animate-in fade-in zoom-in duration-700">
                  <div className="w-12 h-12 bg-green-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-green-600 text-2xl shadow-sm">✨</div>
                  <div>
                    <p className="text-[10px] font-black text-green-800 tracking-widest uppercase mb-1">{t('checkout.eliteLogisticsTier')}</p>
                    <p className="text-[11px] font-medium text-green-700 leading-relaxed">{t('checkout.complimentaryShipping')}</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8 px-6 text-center">
              <p className="text-[9px] text-gray-300 font-bold uppercase tracking-[0.2em] leading-loose">
                {t('checkout.secureTransmission')} <span className="text-gray-400">GOKNARY INT.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
