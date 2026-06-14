export const parseProductImages = (images: string | string[] | undefined | null): string[] => {
  if (!images) return [];
  if (Array.isArray(images)) return images.filter(Boolean);

  try {
    const parsed = JSON.parse(images);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [images];
  } catch {
    return [images];
  }
};

/**
 * Resolves an image path to a full URL.
 * Upload paths (/uploads/...) are served via the API base URL (/api/uploads/...)
 * so they work behind reverse proxies that only forward /api to the backend.
 */
export const getImageUrl = (path: string | undefined | null): string => {
  const placeholder = '/imgs/placeholder.png';

  if (!path) return placeholder;

  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  const apiUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
  const assetsBase = process.env.REACT_APP_ASSETS_URL?.replace(/\/$/, '');

  let cleanPath = path.startsWith('/') ? path.slice(1) : path;
  if (cleanPath.startsWith('api/uploads/')) {
    cleanPath = cleanPath.slice(4);
  }

  if (cleanPath.startsWith('uploads/')) {
    const base = assetsBase || apiUrl;
    return `${base}/${cleanPath}`;
  }

  const assetBaseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;
  return `${assetBaseUrl}/${cleanPath}`;
};