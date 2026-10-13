import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/api';
import {
  CATALOG_PAGE_SIZE,
  CatalogFilterKey,
  CatalogFilters,
  CatalogPagination,
  CatalogProduct,
  CatalogSummary,
  filtersFromSearchParams,
  filtersToApiParams,
  filtersToSearchParams,
} from '../lib/productCatalog';

const SEARCH_DEBOUNCE_MS = 350;

interface Options {
  endpoint: string;
  allowedFilters: CatalogFilterKey[];
  /** Summary counts depend only on this scope (e.g. the admin vendor filter), not on the other filters. */
  summaryScope?: (filters: CatalogFilters) => string;
}

/**
 * Catalog state lives in the URL (`?q=…&status=…&page=…`) so reload, back and shared links keep it.
 * The search box is debounced before it reaches the URL; every other change applies immediately and
 * resets to page 1. Previous rows stay on screen while the next page loads.
 */
export const useProductCatalog = ({ endpoint, allowedFilters, summaryScope }: Options) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => filtersFromSearchParams(searchParams, allowedFilters), [searchParams, allowedFilters]);

  const [searchText, setSearchText] = useState(filters.q);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [pagination, setPagination] = useState<CatalogPagination | null>(null);
  const [summary, setSummary] = useState<CatalogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadedSummaryKey = useRef<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const updateFilters = useCallback(
    (changes: Partial<CatalogFilters>, options: { keepPage?: boolean; replace?: boolean } = {}) => {
      const next = { ...filtersRef.current, ...changes };
      if (!options.keepPage && changes.page === undefined) next.page = 1;
      setSearchParams(filtersToSearchParams(next), { replace: options.replace });
    },
    [setSearchParams],
  );

  // URL → input (back/forward, clear filters); a trailing space the user is still typing is kept.
  useEffect(() => {
    setSearchText((current) => (current.trim() === filters.q.trim() ? current : filters.q));
  }, [filters.q]);

  // Input → URL, debounced; typing replaces the history entry instead of adding one per keystroke.
  useEffect(() => {
    if (searchText.trim() === filtersRef.current.q.trim()) return undefined;
    const timer = setTimeout(() => updateFilters({ q: searchText }, { replace: true }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText, updateFilters]);

  const scopeKey = summaryScope ? summaryScope(filters) : '';
  const apiParams = useMemo(() => filtersToApiParams(filters, CATALOG_PAGE_SIZE), [filters]);
  const apiKey = JSON.stringify(apiParams);

  useEffect(() => {
    const controller = new AbortController();
    const summaryKey = `${scopeKey}#${reloadKey}`;
    const wantsSummary = loadedSummaryKey.current !== summaryKey;
    setLoading(true);
    setError(null);

    api
      .get(endpoint, {
        params: { ...JSON.parse(apiKey), ...(wantsSummary ? { includeSummary: 'true' } : {}) },
        signal: controller.signal,
      })
      .then((response) => {
        const data = response.data;
        const nextPagination: CatalogPagination = data.pagination;
        // A page past the end (e.g. after deleting the last row) moves to the real last page.
        if (nextPagination && filtersRef.current.page > nextPagination.totalPages) {
          updateFilters({ page: nextPagination.totalPages }, { replace: true });
          return;
        }
        setProducts(Array.isArray(data.products) ? data.products : []);
        setPagination(nextPagination ?? null);
        if (data.summary) {
          setSummary(data.summary);
          loadedSummaryKey.current = summaryKey;
        }
        setLoading(false);
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        setError(err);
        setLoading(false);
      });

    return () => controller.abort();
  }, [endpoint, apiKey, scopeKey, reloadKey, updateFilters]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const clearFilters = useCallback(() => {
    setSearchText('');
    setSearchParams(filtersToSearchParams({ ...filtersRef.current, q: '', vendorId: '', status: '', categoryId: '', stock: '', featured: '', page: 1 }));
  }, [setSearchParams]);

  return {
    filters,
    searchText,
    setSearchText,
    updateFilters,
    clearFilters,
    products,
    pagination,
    summary,
    loading,
    error,
    reload,
    /** True only before the first response; later loads keep the previous rows visible. */
    initialLoading: loading && pagination === null && !error,
  };
};
