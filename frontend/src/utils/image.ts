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

/** For the above-the-fold main product image. React 18 only forwards the lowercase HTML attribute. */
export const HIGH_FETCH_PRIORITY = { fetchpriority: 'high' } as Record<string, string>;

/** Neutral inline placeholder for missing images; needs no network request or bundled file. */
export const IMAGE_PLACEHOLDER = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#f3f4f6"/>' +
    '<g fill="none" stroke="#d1d5db" stroke-width="12" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="130" y="140" width="140" height="120" rx="14"/><circle cx="170" cy="180" r="12"/>' +
    '<path d="M270 230l-38-38-82 68"/></g></svg>'
)}`;

/**
 * Resolves an image path to a full URL.
 * Upload paths (/uploads/...) are served via the API base URL (/api/uploads/...)
 * so they work behind reverse proxies that only forward /api to the backend.
 */
export const resolveImageUrl = (
  path: string | undefined | null,
  configuredApiUrl = '/api',
  configuredAssetsUrl?: string,
): string => {
  if (!path) return IMAGE_PLACEHOLDER;

  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  const apiUrl = configuredApiUrl.replace(/\/$/, '');
  const assetsBase = configuredAssetsUrl?.replace(/\/$/, '');

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

export const getImageUrl = (path: string | undefined | null): string =>
  resolveImageUrl(
    path,
    process.env.REACT_APP_API_URL || '/api',
    process.env.REACT_APP_ASSETS_URL,
  );
