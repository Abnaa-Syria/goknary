import React from 'react';
import { SEO } from '../components/common/SEO';

const TermsConditionsPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Terms & Conditions"
        description="Read the terms and conditions for using the GoKnary platform."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8 text-sm sm:text-base text-gray-700 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions</h1>
          <p>
            By using GoKnary, you agree to the terms and conditions outlined in this document. Please read
            them carefully before using our website or services.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Use of the Platform</h2>
            <p>
              You agree to use GoKnary only for lawful purposes and in accordance with all applicable
              laws and regulations.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Accounts &amp; Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for
              all activities that occur under your account.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Orders &amp; Payments</h2>
            <p>
              All orders are subject to availability and confirmation of the order price. We reserve the
              right to cancel or refuse any order at our discretion.
            </p>
          </div>

          <p className="text-xs text-gray-500">
            This is a simplified terms document for demo purposes. Replace with your own legal content.
          </p>
        </div>
      </div>
    </>
  );
};

export default TermsConditionsPage;


