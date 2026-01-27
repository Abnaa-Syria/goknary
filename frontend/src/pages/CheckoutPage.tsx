import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchCart, clearCartState } from '../store/slices/cartSlice';
import { formatPrice } from '../lib/utils';
import api from '../lib/api';

interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

const CheckoutPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { items, subtotal, itemCount, loading } = useAppSelector((state) => state.cart);
  const { isAuthenticated: authStatus } = useAppSelector((state) => state.auth);
  const [step, setStep] = useState<'address' | 'review'>('address');
  const [submitting, setSubmitting] = useState(false);
  const [address, setAddress] = useState<Address>({
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Egypt',
  });

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

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
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.fullName || !address.phone || !address.addressLine1 || !address.city || !address.postalCode) {
      alert('Please fill in all required fields');
      return;
    }
    setStep('review');
  };

  // Local helper to reuse same session id logic as cart slice for guest carts
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
      const sessionId = getSessionId();
      const response = await api.post('/orders', {
        address,
        shippingMethod: 'Standard',
      }, {
        headers: {
          'x-session-id': sessionId,
        },
      });

      // Clear cart
      dispatch(clearCartState());

      // Navigate to order confirmation
      const orderId = response.data.orders[0]?.id;
      navigate(`/account/orders/${orderId}?success=true`);
    } catch (error: any) {
      console.error('Error placing order:', error);
      alert(error.response?.data?.error || 'Failed to place order. Please try again.');
      setSubmitting(false);
    }
  };

  const shippingCost = subtotal >= 500 ? 0 : 50;
  const total = subtotal + shippingCost;

  if (loading || items.length === 0) {
    return (
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        <div className="text-center">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
      <h1 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6 lg:mb-8">{t('checkout.checkout')}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {step === 'address' ? (
            <div className="card p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">{t('checkout.shippingAddress')}</h2>
              <form onSubmit={handleAddressSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('checkout.fullName')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={address.fullName}
                    onChange={(e) => handleAddressChange('fullName', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('checkout.phone')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={address.phone}
                    onChange={(e) => handleAddressChange('phone', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('checkout.address')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={address.addressLine1}
                    onChange={(e) => handleAddressChange('addressLine1', e.target.value)}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Address Line 2</label>
                  <input
                    type="text"
                    value={address.addressLine2}
                    onChange={(e) => handleAddressChange('addressLine2', e.target.value)}
                    className="input-field"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('checkout.city')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={address.city}
                      onChange={(e) => handleAddressChange('city', e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">State/Governorate</label>
                    <input
                      type="text"
                      value={address.state}
                      onChange={(e) => handleAddressChange('state', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      {t('checkout.postalCode')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={address.postalCode}
                      onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Country</label>
                    <input
                      type="text"
                      value={address.country}
                      onChange={(e) => handleAddressChange('country', e.target.value)}
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/cart')}
                    className="btn-outline flex-1"
                  >
                    {t('common.back')}
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    {t('common.next')}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card p-4 sm:p-6">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Review Order</h2>

              {/* Address Summary */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-bold mb-2">Shipping Address</h3>
                <p>{address.fullName}</p>
                <p>{address.phone}</p>
                <p>{address.addressLine1}</p>
                {address.addressLine2 && <p>{address.addressLine2}</p>}
                <p>
                  {address.city}
                  {address.state && `, ${address.state}`} {address.postalCode}
                </p>
                <p>{address.country}</p>
                <button
                  onClick={() => setStep('address')}
                  className="text-primary-500 hover:underline text-sm mt-2"
                >
                  Change Address
                </button>
              </div>

              {/* Order Items */}
              <div className="mb-6">
                <h3 className="font-bold mb-4">Order Items</h3>
                <div className="space-y-4">
                  {items.map((item) => {
                    const displayPrice = item.discountPrice || item.price;
                    const mainImage = item.product.images?.[0] || '/imgs/default-product.jpg';

                    return (
                      <div key={item.id} className="flex gap-3 sm:gap-4">
                        <img
                          src={mainImage}
                          alt={item.product.name}
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover flex-shrink-0"
                        />
                        <div className="flex-grow min-w-0">
                          <h4 className="font-medium text-sm sm:text-base truncate">{item.product.name}</h4>
                          <p className="text-xs sm:text-sm text-gray-500">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-medium text-sm sm:text-base">{formatPrice(displayPrice * item.quantity)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                <button
                  onClick={() => setStep('address')}
                  className="btn-outline flex-1"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceOrder}
                  disabled={submitting}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {submitting ? 'Placing Order...' : 'Place Order'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="card p-4 sm:p-6 lg:sticky lg:top-4">
            <h2 className="text-xl font-bold mb-4">Order Summary</h2>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Items ({itemCount})</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium">
                  {shippingCost === 0 ? (
                    <span className="text-green-600">Free</span>
                  ) : (
                    formatPrice(shippingCost)
                  )}
                </span>
              </div>
              <div className="border-t pt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </div>
            </div>

            {subtotal < 500 && (
              <p className="text-sm text-gray-500 text-center mb-4">
                Add {formatPrice(500 - subtotal)} more for free shipping!
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
