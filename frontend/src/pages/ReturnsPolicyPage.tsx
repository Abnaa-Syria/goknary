import React from 'react';
import { SEO } from '../components/common/SEO';

const ReturnsPolicyPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Returns & Refunds"
        description="Read about GoKnary returns, refunds, and exchange policy."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8 text-sm sm:text-base text-gray-700 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Returns & Refunds</h1>
          <p>
            We want you to be completely satisfied with your purchase. If you are not happy with a product,
            you may be eligible for a return or refund under the conditions below.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Return Window</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Most items can be returned within 14 days from the delivery date.</li>
              <li>Items must be unused, in original packaging, and with all tags attached.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Non-returnable Items</h2>
            <p>For hygiene and safety reasons, some categories (e.g. personal care products) may be non-returnable.</p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">How to Request a Return</h2>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Go to “My Orders” in your account.</li>
              <li>Select the order and item you want to return.</li>
              <li>Submit a return request and follow the instructions.</li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
};

export default ReturnsPolicyPage;


