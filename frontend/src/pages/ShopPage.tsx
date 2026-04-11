import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  FiFilter, 
  FiSearch, 
  FiChevronDown, 
  FiChevronUp, 
  FiX, 
  FiStar,
  FiShoppingCart,
  FiArrowRight,
  FiArrowLeft
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../lib/api';
import ProductCard from '../components/product/ProductCard';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';
import i18n from 'i18n';

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface PaginationData {
  totalCount: number;
  currentPage: number;
  limit: number;
  totalPages: number;
}

const ShopPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for products and metadata
  const [products, setProducts] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pagination, setPagination] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  
  // State for filter lists
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  
  // UI State
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    categories: true,
    brands: true,
    price: true,
    rating: true
  });
  const [showMore, setShowMore] = useState<Record<string, boolean>>({
    categories: false,
    brands: false
  });

  // Current filter state from URL (with normalization fallback)
  const filters = useMemo(() => ({
    q: searchParams.get('q') || '',
    category: [
      ...searchParams.getAll('category'),
      ...searchParams.getAll('categoryId') // Legacy support
    ],
    brand: [
      ...searchParams.getAll('brand'),
      ...searchParams.getAll('brandId') // Legacy support
    ],
    priceMin: searchParams.get('priceMin') || searchParams.get('minPrice') || '',
    priceMax: searchParams.get('priceMax') || searchParams.get('maxPrice') || '',
    rating: searchParams.get('rating') || searchParams.get('minRating') || '',
    page: searchParams.get('page') || '1',
    sort: searchParams.get('sort') || 'relevance'
  }), [searchParams]);

  const [searchValue, setSearchValue] = useState(filters.q);
  const debouncedSearchValue = useDebounce(searchValue, 500);

  useEffect(() => {
    fetchFilters();
  }, []); // Only fetch filters once

  useEffect(() => {
    fetchProducts();
  }, [searchParams]); // Refetch results whenever URL changes

  useEffect(() => {
    if (debouncedSearchValue !== filters.q) {
      updateFilters({ q: debouncedSearchValue });
    }
  }, [debouncedSearchValue]);

  // Sync internal search state with URL (e.g. on back/forward nav)
  useEffect(() => {
    setSearchValue(filters.q);
  }, [filters.q]);

  const fetchFilters = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get('/categories'),
        api.get('/brands')
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
    } catch (error) {
      console.error('Failed to fetch filters:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      
      // Strict Parameter Normalization for Backend Alignment
      const cleanParams = new URLSearchParams();
      
      // Map sort values (price_desc -> price_high, price_asc -> price_low)
      let sortVal = searchParams.get('sort') || 'relevance';
      if (sortVal === 'price_desc') sortVal = 'price_high';
      if (sortVal === 'price_asc') sortVal = 'price_low';
      
      // Populate cleanParams with mapped keys
      cleanParams.set('q', searchParams.get('q') || '');
      cleanParams.set('sort', sortVal);
      cleanParams.set('page', searchParams.get('page') || '1');
      cleanParams.set('limit', searchParams.get('limit') || '24');
      
      const priceMin = searchParams.get('priceMin') || searchParams.get('minPrice');
      if (priceMin) cleanParams.set('priceMin', priceMin);
      
      const priceMax = searchParams.get('priceMax') || searchParams.get('maxPrice');
      if (priceMax) cleanParams.set('priceMax', priceMax);
      
      const rating = searchParams.get('rating') || searchParams.get('minRating');
      if (rating) cleanParams.set('rating', rating);
      
      const vendorId = searchParams.get('vendorId');
      if (vendorId) cleanParams.set('vendorId', vendorId);

      // Handle multi-value category and brand
      const cats = [...searchParams.getAll('category'), ...searchParams.getAll('categoryId')];
      cats.forEach(c => cleanParams.append('category', c));
      
      const brands = [...searchParams.getAll('brand'), ...searchParams.getAll('brandId')];
      brands.forEach(b => cleanParams.append('brand', b));

      const response = await api.get('/products', { params: cleanParams });
      
      // Robust data resolution for products and counts
      setProducts(response.data.products || []);
      setTotalCount(response.data.totalCount ?? response.data.pagination?.totalCount ?? 0);
      setPagination(response.data.pagination || null);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to sync with product ecosystem');
      setProducts([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const updateFilters = (newFilters: any) => {
    const params = new URLSearchParams(searchParams);
    
    // Handle pagination reset on filter change
    if (!newFilters.page) {
      params.set('page', '1');
    }

    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        params.delete(key);
        value.forEach(v => params.append(key, v));
      } else if (value) {
        params.set(key, value as string);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
  };

  const toggleFilter = (type: 'category' | 'brand', id: string) => {
    const current = filters[type];
    const updated = current.includes(id) 
      ? current.filter(item => item !== id)
      : [...current, id];
    updateFilters({ [type]: updated });
  };

  const handlePriceChange = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    updateFilters({
      priceMin: formData.get('priceMin'),
      priceMax: formData.get('priceMax')
    });
  };

  const clearFilters = () => {
    setSearchParams({});
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const FilterSection = ({ title, id, children }: { title: string, id: string, children: React.ReactNode }) => (
    <div className="border-b border-gray-100 py-4">
      <button 
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full text-sm font-black uppercase tracking-widest text-gray-900 mb-2"
      >
        {title}
        {expandedSections[id] ? <FiChevronUp /> : <FiChevronDown />}
      </button>
      <AnimatePresence>
        {expandedSections[id] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/30 lg:py-8 py-4">
      <div className="container mx-auto px-4">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 text-start">
          <div className="text-start">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">{t('shop.masterCatalog', 'Master Catalog')}</h1>
            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">{t('shop.discoverEntities', '{{count}} Entities Discovered in Ecosystem', { count: totalCount })}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group flex-1 md:flex-initial">
              <FiSearch className="absolute start-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" style={{ width: 18, height: 18 }} />
              <input
                type="text"
                placeholder={t('shop.searchPlaceholder', 'Search catalog...')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full md:w-64 ps-12 pe-4 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-primary-500 outline-none transition-all shadow-sm"
              />
            </div>
            <button 
              onClick={() => setIsMobileFiltersOpen(true)}
              className="lg:hidden p-3 bg-white border border-gray-200 rounded-2xl text-gray-900 shadow-sm"
            >
              <FiFilter style={{ width: 20, height: 20 }} />
            </button>
            <select
              value={filters.sort}
              onChange={(e) => updateFilters({ sort: e.target.value })}
              className="hidden md:block bg-white border border-gray-200 text-gray-900 text-sm font-bold rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-primary-500 shadow-sm cursor-pointer"
            >
              <option value="relevance">{t('shop.sortRelevance', 'Relevance')}</option>
              <option value="newest">{t('shop.sortNewest', 'Newest Arrivals')}</option>
              <option value="price_low">{t('shop.sortPriceLow', 'Price: Low to High')}</option>
              <option value="price_high">{t('shop.sortPriceHigh', 'Price: High to Low')}</option>
              <option value="rating">{t('shop.sortRating', 'Top Rated')}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-8 items-start">
          {/* Sidebar - Desktop */}
          <aside className="hidden lg:block w-72 flex-shrink-0 sticky top-24 text-start">
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-black text-gray-900">{t('shop.filters', 'Filters')}</h2>
                <button onClick={clearFilters} className="text-xs font-bold text-primary-500 hover:text-primary-600 uppercase">{t('shop.clearAll', 'Clear All')}</button>
              </div>

              {/* Category Filter */}
              <FilterSection title={t('shop.categories', 'Categories')} id="categories">
                <div className="space-y-2 mt-2">
                  {(showMore.categories ? categories : categories.slice(0, 5)).map(cat => (
                    <label key={cat.id} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.category.includes(cat.id)}
                          onChange={() => toggleFilter('category', cat.id)}
                          className="peer appearance-none w-5 h-5 border-2 border-gray-200 rounded-lg checked:border-primary-500 checked:bg-primary-500 transition-all cursor-pointer"
                        />
                        <FiFilter className="absolute text-white scale-0 peer-checked:scale-75 transition-transform start-0 end-0 mx-auto" style={{ width: 14, height: 14 }} />
                      </div>
                      <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">
                        {i18n.language === 'ar' && (cat as any).nameAr ? (cat as any).nameAr : cat.name}
                      </span>
                    </label>
                  ))}
                  {categories.length > 5 && (
                    <button 
                      onClick={() => setShowMore(p => ({ ...p, categories: !p.categories }))}
                      className="text-xs font-black text-gray-400 hover:text-primary-500 mt-2 uppercase tracking-tighter"
                    >
                      {showMore.categories ? t('shop.showLess', 'Show Less') : t('shop.more', '+ {{count}} More', { count: categories.length - 5 })}
                    </button>
                  )}
                </div>
              </FilterSection>

              {/* Brand Filter */}
              <FilterSection title={t('shop.brands', 'Brands')} id="brands">
                <div className="space-y-2 mt-2">
                  {(showMore.brands ? brands : brands.slice(0, 5)).map(brand => (
                    <label key={brand.id} className="flex items-center gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filters.brand.includes(brand.id)}
                        onChange={() => toggleFilter('brand', brand.id)}
                        className="appearance-none w-5 h-5 border-2 border-gray-200 rounded-lg checked:border-primary-500 checked:bg-primary-500 transition-all cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-600 group-hover:text-gray-900 transition-colors">{brand.name}</span>
                    </label>
                  ))}
                  {brands.length > 5 && (
                    <button 
                      onClick={() => setShowMore(p => ({ ...p, brands: !p.brands }))}
                      className="text-xs font-black text-gray-400 hover:text-primary-500 mt-2 uppercase tracking-tighter"
                    >
                      {showMore.brands ? t('shop.showLess', 'Show Less') : t('shop.more', '+ {{count}} More', { count: brands.length - 5 })}
                    </button>
                  )}
                </div>
              </FilterSection>

              {/* Price Range Filter */}
              <FilterSection title={t('shop.priceLogistics', 'Price Logistics')} id="price">
                <form onSubmit={handlePriceChange} className="mt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <input
                      name="priceMin"
                      type="number"
                      placeholder={t('common.min', 'Min')}
                      defaultValue={filters.priceMin}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                      name="priceMax"
                      type="number"
                      placeholder={t('common.max', 'Max')}
                      defaultValue={filters.priceMax}
                      className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: t('shop.underAmount', { amount: 500 }), min: '0', max: '500' },
                      { label: '500 - 2000', min: '500', max: '2000' },
                      { label: t('shop.overAmount', { amount: 2000 }), min: '2000', max: '' }
                    ].map(range => (
                      <button
                        key={range.label}
                        type="button"
                        onClick={() => updateFilters({ priceMin: range.min, priceMax: range.max })}
                        className={`text-[10px] font-black uppercase py-2 px-1 rounded-lg border transition-all ${
                          filters.priceMin === range.min && filters.priceMax === range.max
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-white text-gray-500 border-gray-100 hover:border-primary-100'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                  <button type="submit" className="w-full py-2 bg-gray-900 text-white text-xs font-black uppercase rounded-xl hover:bg-black transition-colors">
                    {t('shop.applyBounds', 'Apply Bounds')}
                  </button>
                </form>
              </FilterSection>

              {/* Rating Filter */}
              <FilterSection title={t('shop.ecosystemRating', 'Ecosystem Rating')} id="rating">
                <div className="space-y-2 mt-2">
                  {[4, 3, 2].map(star => (
                    <button
                      key={star}
                      onClick={() => updateFilters({ rating: star.toString() })}
                      className={`flex items-center gap-2 w-full p-2 rounded-xl transition-all ${
                        filters.rating === star.toString() ? 'bg-primary-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex gap-0.5 text-yellow-400">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <FiStar key={i} className={i < star ? 'fill-current' : 'text-gray-200'} style={{ width: 14, height: 14 }} />
                        ))}
                      </div>
                      <span className="text-xs font-bold text-gray-600">{t('shop.andUp', '& Up')}</span>
                    </button>
                  ))}
                </div>
              </FilterSection>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-grow">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-white rounded-3xl animate-pulse" />
                ))}
              </div>
            ) : products.length > 0 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {/* Pagination Controls */}
                {pagination && pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-16 py-8 border-t border-gray-100">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                      {t('shop.pageOf', 'Visualizing Page {{current}} of {{total}}', { current: pagination.currentPage, total: pagination.totalPages })}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateFilters({ page: (pagination.currentPage - 1).toString() })}
                        disabled={pagination.currentPage === 1}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                      >
                        <FiArrowLeft className="rtl:rotate-180" /> {t('shop.prev', 'Prev')}
                      </button>
                      
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }).map((_, i) => {
                          const pNum = i + 1;
                          return (
                            <button
                              key={pNum}
                              onClick={() => updateFilters({ page: pNum.toString() })}
                              className={`w-12 h-12 rounded-2xl text-sm font-black transition-all ${
                                pagination.currentPage === pNum 
                                  ? 'bg-primary-500 text-white shadow-lg shadow-primary-200' 
                                  : 'bg-white border border-gray-100 text-gray-400 hover:border-primary-500'
                              }`}
                            >
                              {pNum}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        onClick={() => updateFilters({ page: (pagination.currentPage + 1).toString() })}
                        disabled={pagination.currentPage === pagination.totalPages}
                        className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-sm font-black uppercase tracking-widest disabled:opacity-30 hover:border-primary-500 transition-all"
                      >
                        {t('shop.next', 'Next')} <FiArrowRight className="rtl:rotate-180" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-[2.5rem] p-24 text-center border border-gray-100 shadow-sm">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
                  <FiShoppingCart className="text-gray-300" style={{ width: 40, height: 40 }} />
                </div>
                <h3 className="text-2xl font-black text-gray-900 uppercase">Ecosystem Nullity</h3>
                <p className="text-gray-400 font-bold mt-2 uppercase tracking-widest text-sm">No entities discovered with current coordinates</p>
                <button 
                  onClick={clearFilters}
                  className="mt-8 px-10 py-4 bg-primary-500 text-white text-xs font-black uppercase rounded-2xl shadow-xl shadow-primary-100 hover:bg-primary-600 transition-all"
                >
                  Reset Discovery Coordinates
                </button>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileFiltersOpen(false)} />
          <motion.div 
            initial={{ x: i18n.dir() === 'rtl' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            className="absolute end-0 top-0 bottom-0 w-80 bg-white p-6 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black uppercase">{t('shop.refine', 'Refine')}</h2>
              <button onClick={() => setIsMobileFiltersOpen(false)}><FiX style={{ width: 24, height: 24 }} /></button>
            </div>
            <p className="text-sm text-gray-400 font-bold uppercase">{t('shop.mobileFiltersDesc', 'Dynamic filters active in sidebar...')}</p>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default ShopPage;
