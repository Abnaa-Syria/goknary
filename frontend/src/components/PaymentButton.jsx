import React, { useState } from 'react';
import api from '../lib/api';

/**
 * PaymentButton Component
 * Triggers the Kashier Session API flow via the backend and redirects
 * the user to the hosted checkout page.
 */
const PaymentButton = ({ orderData, onInitiate }) => {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    if (loading) return;
    
    setLoading(true);
    try {
      // 1. Create the order(s) in your DB first to get order IDs and customer info
      const initData = await onInitiate();
      
      const orderIds = initData?.orderIds || (initData?.orderId ? [initData.orderId] : []);
      if (!initData || orderIds.length === 0) {
        throw new Error('Could not create order. Please try again.');
      }

      // 2. Call your backend to initiate the Kashier Session
      const response = await api.post('/payment/initiate', {
        orderId: orderIds[0],
        orderIds,
        amount: initData.amount,
        customerEmail: initData.customerEmail,
        currency: orderData.currency || 'EGP'
      });

      // 3. Extract the sessionUrl returned by the backend
      const { success, sessionUrl, message } = response.data;

      if (success && sessionUrl) {
        console.log("🚀 Redirecting to Kashier Hosted Checkout...");
        // 4. Perform full page redirect to Kashier
        window.location.href = sessionUrl;
      } else {
        throw new Error(message || 'Failed to obtain session URL');
      }

    } catch (error) {
      console.error("❌ Kashier Payment Error:", error);
      alert(`Payment Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="w-full py-5 px-6 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-200 hover:bg-primary-700 active:scale-95 transition-all flex items-center justify-center gap-3 text-xs tracking-widest uppercase font-black disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? (
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
      ) : (
        <>
          Pay Securely with Kashier
          <svg className="w-4 h-4 rtl:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </>
      )}
    </button>
  );
};

export default PaymentButton;
