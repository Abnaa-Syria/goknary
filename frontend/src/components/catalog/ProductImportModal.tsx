import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { RefreshCw, Tag, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { flattenCategoryTree } from '../../utils/categoryTree';
import { getApiErrorMessage } from '../../lib/productCatalog';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  categories: any[];
}

const SAMPLE_IMPORT_JSON = JSON.stringify([
  {
    name: 'Sample Smart Watch',
    price: 1200,
    stock: 50,
    lowStockThreshold: 10,
    categoryId: 'paste_category_id_here',
    description: 'Premium fitness smartwatch',
  },
], null, 2);

/** The existing vendor JSON bulk import (POST /vendor/products/import), unchanged, as a reusable modal. */
const ProductImportModal: React.FC<Props> = ({ open, onClose, onImported, categories }) => {
  const { t, i18n } = useTranslation();
  const [importData, setImportData] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !importing) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, importing, onClose]);

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importData.trim()) return;

    let parsedProducts = [];
    try {
      parsedProducts = JSON.parse(importData);
      if (!Array.isArray(parsedProducts)) {
        throw new Error(t('vendor.productsPage.invalidJsonArray', 'Data must be a JSON array of product objects'));
      }
    } catch (err: any) {
      toast.error(t('vendor.productsPage.invalidJson', 'Invalid JSON: {{message}}', { message: err.message }));
      return;
    }

    setImporting(true);
    try {
      const response = await api.post('/vendor/products/import', { products: parsedProducts });
      toast.success(response.data.message || t('vendor.productsPage.importSuccess', 'Products imported successfully!'));
      setImportData('');
      onImported();
      onClose();
    } catch (error: any) {
      toast.error(getApiErrorMessage(error, i18n.language === 'ar', t('vendor.productsPage.importFailed', 'Failed to import product batch')));
    } finally {
      setImporting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !importing && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-import-title"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10 flex flex-col max-h-[85vh] text-start"
          >
            <h2 id="product-import-title" className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Upload className="text-gray-700" aria-hidden="true" />
              {t('vendor.productsPage.bulkImportTitle', 'Bulk Product Import')}
            </h2>
            <p className="text-gray-500 text-xs mb-4">
              {t('vendor.productsPage.bulkImportDesc', 'Paste a JSON array matching the catalog structure.')}
            </p>

            <div className="flex-1 overflow-y-auto space-y-4 pe-1 custom-scrollbar">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Tag size={12} aria-hidden="true" />
                  {t('vendor.productsPage.availableCategoryIds', 'Available Category IDs')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-28 overflow-y-auto custom-scrollbar">
                  {flattenCategoryTree(categories).map(({ category: c, depth }) => (
                    <div key={c.id} className="flex justify-between gap-2 bg-white border border-gray-200/50 p-2 rounded-lg font-mono">
                      <span className="font-sans font-semibold text-gray-700 truncate max-w-[120px]" style={{ paddingInlineStart: depth * 8 }}>{depth > 0 ? '└ ' : ''}{c.name}</span>
                      <span className="text-gray-900 select-all text-[10px]">{c.id}</span>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={handleBulkImport} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="product-import-json" className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {t('vendor.productsPage.jsonPayloadArray', 'JSON Payload Array')}
                    </label>
                    <button type="button" onClick={() => setImportData(SAMPLE_IMPORT_JSON)} className="text-xs text-gray-900 underline font-semibold min-h-[32px]">
                      {t('vendor.productsPage.loadSampleJson', 'Load Sample JSON')}
                    </button>
                  </div>
                  <textarea
                    id="product-import-json"
                    rows={8}
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    required
                    dir="ltr"
                    placeholder={`[\n  {\n    "name": "Product Name",\n    "price": 100,\n    "stock": 10,\n    "categoryId": "..."\n  }\n]`}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900 focus:bg-white text-xs font-mono"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={importing}
                    onClick={onClose}
                    className="flex-1 min-h-[44px] border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 text-sm"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={importing || !importData.trim()}
                    className="flex-1 min-h-[44px] bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {importing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                        {t('vendor.productsPage.importingBatches', 'Importing batches...')}
                      </>
                    ) : (
                      <>
                        <Upload size={14} aria-hidden="true" />
                        {t('vendor.productsPage.submitImport', 'Submit Import')}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ProductImportModal;
