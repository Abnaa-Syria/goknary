import React from 'react';
import { SEO } from '../components/common/SEO';

const SupportContactPage: React.FC = () => {
  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with the GoKnary support team for any questions or issues."
      />
      <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8 lg:py-10">
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-card p-4 sm:p-6 lg:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4">Contact Us</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            Have a question about an order, your account, or selling on GoKnary? Fill in the form
            below and our support team will get back to you as soon as possible.
          </p>

          <form className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm"
                placeholder="How can we help?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <textarea
                rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none text-sm resize-none"
                placeholder="Please provide as many details as possible..."
              />
            </div>

            <button
              type="submit"
              className="w-full sm:w-auto px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded-lg text-sm sm:text-base transition-colors"
            >
              Send Message
            </button>
          </form>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">Customer Support</h2>
              <p>Email: support@goknary.com</p>
              <p>Hours: 9:00 AM – 9:00 PM (All week)</p>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">For Vendors</h2>
              <p>Email: vendors@goknary.com</p>
              <p>We’ll help you grow your business on GoKnary.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SupportContactPage;


