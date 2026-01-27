import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Social Media Icons
const FacebookIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TwitterIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
  </svg>
);

const InstagramIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

const LinkedInIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const Footer: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <footer className="bg-secondary-900 text-white mt-auto">
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* Compact Grid Layout */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6 mb-4 sm:mb-5">
          {/* Brand & Newsletter */}
          <div className="col-span-2">
            <Link to="/" className="inline-block mb-2">
              <img 
                src="/imgs/WhatsApp_Image_2025-06-01_at_1.44.50_PM-removebg-preview-e1748777559633.webp" 
                alt="GoKnary Logo" 
                className="h-10 w-auto object-contain filter brightness-0 invert"
              />
            </Link>
            <p className="text-gray-300 text-xs mb-3 leading-relaxed">
              {t('footer.subscribeNewsletter')}
            </p>
            {/* Newsletter */}
            <div className="mb-3">
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('footer.emailPlaceholder')}
                  className="flex-1 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded text-white text-xs placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-transparent"
                />
                <button className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold rounded transition-colors text-xs whitespace-nowrap">
                  {t('footer.subscribe')}
                </button>
              </div>
            </div>
            {/* Social Media */}
            <div className="flex gap-2">
              <a href="#" className="w-8 h-8 flex items-center justify-center bg-gray-800/50 hover:bg-primary-500 border border-gray-700/50 hover:border-primary-500 rounded transition-all" aria-label="Facebook">
                <FacebookIcon />
              </a>
              <a href="#" className="w-8 h-8 flex items-center justify-center bg-gray-800/50 hover:bg-primary-500 border border-gray-700/50 hover:border-primary-500 rounded transition-all" aria-label="Twitter">
                <TwitterIcon />
              </a>
              <a href="#" className="w-8 h-8 flex items-center justify-center bg-gray-800/50 hover:bg-primary-500 border border-gray-700/50 hover:border-primary-500 rounded transition-all" aria-label="Instagram">
                <InstagramIcon />
              </a>
              <a href="#" className="w-8 h-8 flex items-center justify-center bg-gray-800/50 hover:bg-primary-500 border border-gray-700/50 hover:border-primary-500 rounded transition-all" aria-label="LinkedIn">
                <LinkedInIcon />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-xs font-bold mb-2 text-white uppercase">{t('footer.quickLinks')}</h3>
            <ul className="space-y-1.5">
              <li><Link to="/" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('common.home')}</Link></li>
              <li><Link to="/account" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.myAccount')}</Link></li>
              <li><Link to="/cart" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('common.cart')}</Link></li>
              <li><Link to="/vendor/apply" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('auth.registerAsVendor')}</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-xs font-bold mb-2 text-white uppercase">{t('footer.customerService')}</h3>
            <ul className="space-y-1.5">
              <li><Link to="/support/contact" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.contactUs')}</Link></li>
              <li><Link to="/support/faq" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.faq')}</Link></li>
              <li><Link to="/support/shipping" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.shippingInfo')}</Link></li>
              <li><Link to="/support/returns" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.returnPolicy')}</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-xs font-bold mb-2 text-white uppercase">{t('footer.termsOfService')}</h3>
            <ul className="space-y-1.5">
              <li><Link to="/legal/privacy" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.privacyPolicy')}</Link></li>
              <li><Link to="/legal/terms" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">{t('footer.termsOfService')}</Link></li>
              <li><Link to="/legal/cookies" className="text-gray-300 hover:text-primary-400 transition-colors text-xs">Cookie Policy</Link></li>
            </ul>
          </div>

          {/* Payment Methods */}
          <div>
            <h3 className="text-xs font-bold mb-2 text-white uppercase">{t('checkout.paymentMethod')}</h3>
            <div className="flex flex-col gap-1.5">
              <span className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs font-medium text-center">Visa</span>
              <span className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs font-medium text-center">Mastercard</span>
              <span className="px-2 py-1 bg-gray-800/50 border border-gray-700/50 rounded text-xs font-medium text-center">{t('checkout.cashOnDelivery')}</span>
            </div>
          </div>
        </div>

        {/* Bottom Bar - Compact */}
        <div className="border-t border-gray-700/30 pt-4">
          <p className="text-xs text-gray-400 text-center">
            {t('footer.allRightsReserved')} &copy; Designed by{' '}
            <a 
              href="https://www.qeematech.net/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-white hover:text-primary-400 transition-colors"
            >
              Qeematech
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
