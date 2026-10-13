import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import api from '../lib/api';
import type { Product } from '../store/slices/productSlice';

/** Customer-shaped product returned by the authenticated preview endpoints, for any status. */
export type PreviewProduct = Product & {
  sku: string;
  status: string;
  featured?: boolean;
  rejectionReason?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewerName?: string | null;
  createdAt: string;
  vendor: Product['vendor'] & { status?: string };
};

export type PreviewState = 'loading' | 'ready' | 'notFound' | 'error';

const parseImages = (raw: unknown): string[] => {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? value.filter((url): url is string => typeof url === 'string' && !!url) : [];
};

/** Legacy rows can carry unreadable images or no variant list; the preview renders them as empty. */
const normalize = (data: any): PreviewProduct => ({
  ...data,
  images: parseImages(data?.images),
  variants: Array.isArray(data?.variants) ? data.variants : [],
});

export const useProductPreview = (url: string) => {
  const [product, setProduct] = useState<PreviewProduct | null>(null);
  const [state, setState] = useState<PreviewState>('loading');
  const [error, setError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    setError(null);
    api
      .get(url, { signal: controller.signal })
      .then((response) => {
        setProduct(normalize(response.data));
        setState('ready');
      })
      .catch((err) => {
        if (axios.isCancel(err)) return;
        const status = err?.response?.status;
        setProduct(null);
        setError(err);
        setState(status === 404 || status === 403 ? 'notFound' : 'error');
      });
    return () => controller.abort();
  }, [url, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return { product, state, error, reload };
};
