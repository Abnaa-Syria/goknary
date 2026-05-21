import React, { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCartState } from '../store/slices/cartSlice';

/**
 * PaymentSuccess Page
 * Displayed after a successful Kashier transaction.
 */
const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get('merchantOrderId') || searchParams.get('orderId') || searchParams.get('order_id');
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(clearCartState());
    localStorage.removeItem('cart_session_id');
    localStorage.removeItem('cartSessionId');
  }, [dispatch]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center border border-gray-50 transform transition-all hover:scale-[1.01]">
        {/* Animated Checkmark Icon */}
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center animate-bounce">
            <svg 
              className="w-10 h-10 text-green-600" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="3" 
                d="M5 13l4 4L19 7" 
              />
            </svg>
          </div>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-2 tracking-tight">
          Payment Successful!
        </h1>
        
        <p className="text-gray-500 mb-8 leading-relaxed">
          Thank you for your purchase. Your order 
          <span className="font-bold text-primary-600 mx-1">#{orderId}</span> 
          has been confirmed and is being processed.
        </p>

        <div className="space-y-4">
          <Link
            to="/"
            className="block w-full py-4 px-6 bg-primary-600 text-white rounded-2xl shadow-xl shadow-primary-100 hover:bg-primary-700 active:scale-95 transition-all font-bold text-sm uppercase tracking-widest"
          >
            Return to Home
          </Link>
          
          <Link
            to="/account/orders"
            className="block w-full py-4 px-6 bg-gray-50 text-gray-700 rounded-2xl hover:bg-gray-100 transition-all font-bold text-sm uppercase tracking-widest"
          >
            View My Orders
          </Link>
        </div>

        <p className="mt-8 text-xs text-gray-400 italic">
          A confirmation email has been sent to your inbox.
        </p>
      </div>
    </div>
  );
};

export default PaymentSuccess;
