import React, { useEffect, useState, useRef } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  FileText, 
  Cookie, 
  Globe, 
  Calendar, 
  ChevronRight, 
  Printer, 
  Loader2,
  AlertTriangle
} from 'lucide-react';
import api from '../lib/api';
import { SEO } from '../components/common/SEO';

interface PolicyPageProps {
  defaultKey: 'terms_of_service' | 'privacy_policy' | 'cookie_policy';
}

interface ToCItem {
  id: string;
  text: string;
  level: number;
}

const PolicyPage: React.FC<PolicyPageProps> = ({ defaultKey }) => {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toc, setToc] = useState<ToCItem[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const currentLang = i18n.language || 'en';
  const isRtl = currentLang.startsWith('ar');

  // Map of keys for page definitions
  const policyDocs = [
    {
      key: 'terms_of_service',
      path: '/legal/terms',
      icon: FileText,
      labelEn: 'Terms of Service',
      labelAr: 'شروط الخدمة'
    },
    {
      key: 'privacy_policy',
      path: '/legal/privacy',
      icon: Shield,
      labelEn: 'Privacy Policy',
      labelAr: 'سياسة الخصوصية'
    },
    {
      key: 'cookie_policy',
      path: '/legal/cookies',
      icon: Cookie,
      labelEn: 'Cookie Policy',
      labelAr: 'ملفات تعريف الارتباط'
    }
  ];

  const activeDoc = policyDocs.find(doc => doc.key === defaultKey) || policyDocs[0];

  useEffect(() => {
    fetchPolicy();
  }, [defaultKey, currentLang]);

  const fetchPolicy = async () => {
    setLoading(true);
    setError(null);
    try {
      const dbKey = isRtl ? `${defaultKey}_ar` : defaultKey;
      const response = await api.get(`/settings/policies/${dbKey}`);
      setContent(response.data.value || '');
      generateToC(response.data.value || '');
    } catch (err: any) {
      console.error('Failed to fetch policy:', err);
      setError(isRtl ? 'فشل تحميل السياسة المطلوبة.' : 'Failed to load the requested policy.');
    } finally {
      setLoading(false);
    }
  };

  const generateToC = (markdownText: string) => {
    const lines = markdownText.split('\n');
    const items: ToCItem[] = [];
    lines.forEach((line) => {
      if (line.startsWith('## ')) {
        const text = line.replace('## ', '').trim();
        const id = text
          .toLowerCase()
          .replace(/[^\w\s\u0600-\u06FF-]/g, '')
          .replace(/\s+/g, '-');
        items.push({ id, text, level: 2 });
      }
    });
    setToc(items);
  };

  const renderMarkdown = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();

      // H1 (Title)
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={index} className="text-3xl sm:text-4xl font-extrabold text-gray-900 mt-2 mb-6 tracking-tight">
            {trimmed.replace('# ', '')}
          </h1>
        );
      }

      // H2 (Sections for Table of Contents)
      if (trimmed.startsWith('## ')) {
        const text = trimmed.replace('## ', '');
        const id = text
          .toLowerCase()
          .replace(/[^\w\s\u0600-\u06FF-]/g, '')
          .replace(/\s+/g, '-');
        return (
          <h2 
            key={index} 
            id={id}
            className="text-2xl font-bold text-gray-900 mt-8 mb-4 border-b border-gray-100 pb-2 scroll-mt-24"
          >
            {text}
          </h2>
        );
      }

      // H3
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="text-xl font-semibold text-gray-800 mt-6 mb-3">
            {trimmed.replace('### ', '')}
          </h3>
        );
      }

      // Divider
      if (trimmed === '---') {
        return <hr key={index} className="my-8 border-gray-200" />;
      }

      // Bullet List Items
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        const contentStr = trimmed.substring(2);
        return (
          <li key={index} className="ms-6 list-disc text-gray-650 mb-2 leading-relaxed text-sm sm:text-base">
            {parseInlineFormatting(contentStr)}
          </li>
        );
      }

      // Numbered List Items
      const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (numMatch) {
        const contentStr = numMatch[2];
        return (
          <li key={index} className="ms-6 list-decimal text-gray-650 mb-2 leading-relaxed text-sm sm:text-base">
            {parseInlineFormatting(contentStr)}
          </li>
        );
      }

      // Empty space
      if (trimmed === '') {
        return null;
      }

      // Regular Paragraph
      return (
        <p key={index} className="text-gray-650 leading-relaxed mb-4 text-sm sm:text-base">
          {parseInlineFormatting(trimmed)}
        </p>
      );
    });
  };

  const parseInlineFormatting = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={index} className="font-bold text-gray-950">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleLanguageToggle = () => {
    const nextLang = currentLang.startsWith('ar') ? 'en' : 'ar';
    i18n.changeLanguage(nextLang);
  };

  const activeDocLabel = isRtl ? activeDoc.labelAr : activeDoc.labelEn;

  return (
    <>
      <SEO
        title={activeDocLabel}
        description={`Read our ${activeDocLabel} to understand the terms, rules, and privacy practices of the GoKnary platform.`}
      />
      
      {/* Background Graphic elements */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-secondary-50/40 via-secondary-50/10 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-secondary-200/20 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-80 left-10 w-96 h-96 bg-secondary-100/30 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="container mx-auto px-4 py-10 text-start min-h-[70vh]">
        {/* Breadcrumb Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>{isRtl ? 'القانونية' : 'Legal'}</span>
            <ChevronRight size={12} className={isRtl ? 'rotate-180' : ''} />
            <span className="text-secondary-800 font-bold">{activeDocLabel}</span>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Language Switcher */}
            <button
              onClick={handleLanguageToggle}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-xs font-bold text-gray-700"
            >
              <Globe size={14} className="text-secondary-600" />
              <span>{isRtl ? 'English' : 'العربية'}</span>
            </button>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm text-xs font-bold text-gray-700"
            >
              <Printer size={14} className="text-secondary-600" />
              <span>{isRtl ? 'طباعة' : 'Print'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Navigation Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl border border-gray-150 shadow-sm p-4 sticky top-24">
              <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 px-2">
                {isRtl ? 'وثائق المنصة' : 'Platform Policies'}
              </h4>
              <nav className="space-y-1.5">
                {policyDocs.map((doc) => {
                  const DocIcon = doc.icon;
                  const isActive = doc.key === defaultKey;
                  const label = isRtl ? doc.labelAr : doc.labelEn;
                  return (
                    <Link
                      key={doc.key}
                      to={doc.path}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isActive
                          ? 'bg-secondary-800 text-white shadow-lg shadow-secondary-100'
                          : 'text-gray-750 hover:bg-gray-50 hover:text-secondary-800'
                      }`}
                    >
                      <DocIcon size={16} />
                      <span className="flex-1 text-start">{label}</span>
                      <ChevronRight 
                        size={14} 
                        className={`transition-transform duration-300 opacity-60 ${isActive ? 'translate-x-0.5' : ''} ${isRtl ? 'rotate-180' : ''}`} 
                      />
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3 grid grid-cols-1 xl:grid-cols-4 gap-8">
            {/* The Document Card */}
            <div className="xl:col-span-3">
              <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 p-6 sm:p-10 relative overflow-hidden">
                {/* Visual Top Highlight */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-secondary-500 to-secondary-900" />
                
                <AnimatePresence mode="wait">
                  {loading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-20 space-y-4"
                    >
                      <Loader2 className="w-10 h-10 text-secondary-800 animate-spin" />
                      <p className="text-gray-400 font-bold text-sm">
                        {isRtl ? 'جاري تحميل السياسة...' : 'Fetching policy document...'}
                      </p>
                    </motion.div>
                  ) : error ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col items-center justify-center py-16 text-center space-y-4"
                    >
                      <AlertTriangle className="w-12 h-12 text-red-500" />
                      <p className="text-gray-800 font-bold text-lg">{error}</p>
                      <button 
                        onClick={fetchPolicy}
                        className="px-5 py-2 bg-secondary-800 text-white font-bold rounded-xl shadow-lg hover:bg-secondary-900 transition-all text-sm"
                      >
                        {isRtl ? 'إعادة المحاولة' : 'Try Again'}
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      ref={contentRef}
                      className="prose max-w-none text-start text-gray-850"
                    >
                      {/* Document Details Metadata Header */}
                      <div className="flex items-center gap-2 mb-6 text-gray-400 text-xs font-semibold">
                        <Calendar size={14} className="text-secondary-600" />
                        <span>
                          {isRtl ? 'آخر تحديث: 8 يونيو 2026' : 'Last updated: June 8, 2026'}
                        </span>
                      </div>

                      {renderMarkdown(content)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Side Sticky Table of Contents (ToC) (Desktop Only) */}
            {toc.length > 0 && !loading && !error && (
              <div className="hidden xl:block xl:col-span-1">
                <div className="sticky top-24 space-y-4">
                  <h5 className="text-xs font-black text-gray-450 uppercase tracking-widest px-2">
                    {isRtl ? 'محتويات الصفحة' : 'On This Page'}
                  </h5>
                  <ul className="space-y-3 px-2 border-s border-gray-150">
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="block text-xs font-bold text-gray-500 hover:text-secondary-800 transition-colors py-0.5 leading-normal"
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default PolicyPage;
