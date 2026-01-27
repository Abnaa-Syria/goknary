import React from 'react';
import { SEO } from '../components/common/SEO';

const FAQPage: React.FC = () => {
  const faqs = [
    {
      q: 'How do I place an order?',
      a: 'Browse products, add items to your cart, then go to the cart and click “Proceed to Checkout”. Fill in your shipping details and confirm the order.',
    },
    {
      q: 'What payment methods are accepted?',
      a: 'We currently support card payments (Visa & Mastercard) and Cash on Delivery for selected areas.',
    },
    {
      q: 'How long does delivery take?',
      a: 'Delivery usually takes between 2–5 business days depending on your location and the seller.',
    },
    {
      q: 'How can I track my order?',
      a: 'Go to “My Account” → “Orders” to see the status of your orders and tracking information when available.',
    },
  ];

  return (
    <>
      <SEO
        title="FAQ"
        description="Frequently asked questions about shopping on GoKnary."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">FAQ</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            Find quick answers to the most common questions about orders, shipping, and returns.
          </p>

          <div className="divide-y divide-gray-200">
            {faqs.map((item, idx) => (
              <div key={idx} className="py-4">
                <h2 className="text-sm sm:text-base font-semibold text-gray-900 mb-1">
                  {item.q}
                </h2>
                <p className="text-sm text-gray-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default FAQPage;


