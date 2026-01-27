import React from 'react';
import { SEO } from '../components/common/SEO';

const CookiePolicyPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Cookie Policy"
        description="Learn how GoKnary uses cookies and similar technologies."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8 text-sm sm:text-base text-gray-700 space-y-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Cookie Policy</h1>
          <p>
            This Cookie Policy explains how GoKnary uses cookies and similar technologies to recognize you
            when you visit our website.
          </p>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">What Are Cookies?</h2>
            <p>
              Cookies are small text files that are stored on your device when you visit a website. They
              help us remember your preferences and improve your experience.
            </p>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">How We Use Cookies</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>To keep you signed in and remember your cart.</li>
              <li>To analyze traffic and performance of our website.</li>
              <li>To show relevant offers and promotions.</li>
            </ul>
          </div>

          <div>
            <h2 className="font-semibold text-gray-900 mb-1">Managing Cookies</h2>
            <p>
              You can control cookies through your browser settings. Blocking some types of cookies may
              affect your experience on the site.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CookiePolicyPage;


