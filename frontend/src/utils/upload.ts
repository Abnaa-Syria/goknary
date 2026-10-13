import api from '../lib/api';

/** Carries the server's upload error message (empty when the server sent none). */
export class UploadError extends Error {}

/** Server-provided message for a failed request or upload, else the given fallback. Never a stack trace. */
export const getRequestErrorMessage = (error: any, fallback: string, uploadFallback: string = fallback): string => {
  const serverMessage = error?.response?.data?.error;
  if (typeof serverMessage === 'string' && serverMessage) return serverMessage;
  if (error instanceof UploadError) return error.message || uploadFallback;
  return fallback;
};

/** Field-level messages from a 400 `details` list (`[{ path, message }]`), as "field: message" lines. */
export const getRequestErrorDetails = (error: any, label: (field: string) => string = (field) => field): string[] => {
  const details = error?.response?.data?.details;
  if (!Array.isArray(details)) return [];
  return details
    .filter((d) => d && typeof d.message === 'string')
    .map((d) => {
      const field = Array.isArray(d.path) ? d.path.join('.') : '';
      return field ? `${label(field)}: ${d.message}` : d.message;
    });
};
/**
 * Uploads the local Files in a mixed File/URL list to /api/upload (the server converts them to WebP)
 * and returns the URL list in the same order as the input, so the first item stays the main image.
 */
export const uploadImages = async (items: (File | string)[]): Promise<string[]> => {
  const localFiles = items.filter((item): item is File => item instanceof File);

  if (localFiles.length === 0) {
    return items.filter((item): item is string => typeof item === 'string');
  }

  try {
    const formData = new FormData();
    localFiles.forEach((file) => {
      formData.append('images', file);
    });

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const newlyUploadedUrls: string[] = response.data.urls || [];
    let next = 0;
    return items
      .map((item) => (item instanceof File ? newlyUploadedUrls[next++] : item))
      .filter((url): url is string => typeof url === 'string' && !!url);
  } catch (error: any) {
    const serverMessage = error?.response?.data?.error;
    throw new UploadError(typeof serverMessage === 'string' ? serverMessage : '');
  }
};
