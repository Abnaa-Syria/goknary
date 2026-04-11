export const getImageUrl = (path: string): string => {
  if (!path) return '';

  // لو URL كامل
  if (path.startsWith('http')) {
    return path;
  }

  const baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const assetBaseUrl = baseUrl.replace(/\/api$/, '');

  // تأكد إن فيه slash في النص
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${assetBaseUrl}${normalizedPath}`;
};