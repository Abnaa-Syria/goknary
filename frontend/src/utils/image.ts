/**
 * Resolves an image path to a full URL.
 * Handles:
 * 1. Full URLs (starting with http)
 * 2. Data URLs (starting with data:)
 * 3. Paths starting with 'uploads/' (automatically prepends backend URL)
 * 4. General relative paths
 * 5. Fallback to a placeholder image
 */
export const getImageUrl = (path: string | undefined | null): string => {
  const placeholder = '/imgs/placeholder.png';

  if (!path) return placeholder;

  // If already a full URL or base64 data
  if (path.startsWith('http') || path.startsWith('data:')) {
    return path;
  }

  // Detect and clean API base URL (e.g., http://localhost:5000/api -> http://localhost:5000)
  const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
  const assetBaseUrl = apiUrl.endsWith('/api') ? apiUrl.slice(0, -4) : apiUrl;

  // Cleanup: strip leading slash if present for normalized check
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;

  // Resolve to full backend URL
  return `${assetBaseUrl}/${cleanPath}`;
};