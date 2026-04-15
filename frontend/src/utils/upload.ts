import api from '../lib/api';

/**
 * Expert Upload Utility
 * Filters a mix of File objects and existing string URLs.
 * Uploads local Files to /api/upload and merges them with existing URLs.
 * 
 * @param items Array of File objects or existing URL strings
 * @returns Promise of a clean array of string URLs
 */
export const uploadImages = async (items: (File | string)[]): Promise<string[]> => {
  const localFiles = items.filter((item): item is File => item instanceof File);
  const existingUrls = items.filter((item): item is string => typeof item === 'string');

  if (localFiles.length === 0) {
    return existingUrls;
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

    // The centralized backend returns { urls: ["/uploads/..."] }
    const newlyUploadedUrls = response.data.urls || [];
    
    // Merge existing remote URLs with the fresh batch
    return [...existingUrls, ...newlyUploadedUrls];
  } catch (error) {
    console.error('Batch Upload Failure:', error);
    throw new Error('Failed to synchronize visual assets with the global catalog.');
  }
};
