import React from 'react';
import { SEO } from '../components/common/SEO';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Privacy Policy"
        description="Understand how GoKnary collects, uses, and protects your personal data."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8 text-sm sm:text-base text-gray-700 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p>
            This Privacy Policy explains how GoKnary (“we”, “us”, or “our”) collects, uses, and protects
            your personal information when you use our website and services.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Account information such as your name, email address, and phone number.</li>
              <li>Order and payment information needed to process your purchases.</li>
              <li>Usage data such as pages visited and actions taken on the site.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To process and deliver your orders.</li>
              <li>To provide customer support and respond to your requests.</li>
              <li>To improve our platform, features, and user experience.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Data Protection</h2>
            <p>
              We use appropriate technical and organizational measures to protect your personal data from
              unauthorized access, loss, or misuse.
            </p>
          </div>

          <p className="text-xs text-gray-500">
            This is a simplified policy for demo purposes. You should replace it with a full legal
            document reviewed by a professional.
          </p>
        </div>
      </div>
    </>
  );
};

export default PrivacyPolicyPage;


