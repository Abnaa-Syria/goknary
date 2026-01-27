import React from 'react';
import { SEO } from '../components/common/SEO';

const ShippingInfoPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Shipping Information"
        description="Learn about GoKnary shipping methods, fees, and delivery times."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8 text-sm sm:text-base text-gray-700 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Shipping</h1>
          <p>
            We work with trusted courier partners to deliver your orders as quickly and safely as possible.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Delivery Times</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Major cities: 2–3 business days</li>
              <li>Other areas: 3–5 business days</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Shipping Fees</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Orders above EGP 500: <span className="font-semibold text-green-600">Free shipping</span></li>
              <li>Orders below EGP 500: Standard shipping fee applies at checkout</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Notes</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Delivery times may vary during holidays and sale events.</li>
              <li>You can track your order from the “My Orders” section in your account.</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
};

export default ShippingInfoPage;


