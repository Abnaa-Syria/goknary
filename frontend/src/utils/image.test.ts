import { describe, expect, it } from '@jest/globals';
import { IMAGE_PLACEHOLDER, resolveImageUrl } from './image';

describe('getImageUrl', () => {
  it('uses the same-origin API path for uploaded media by default', () => {
    expect(resolveImageUrl('/uploads/product.webp', '/api')).toBe('/api/uploads/product.webp');
  });

  it('keeps public frontend assets on the deployment origin', () => {
    expect(resolveImageUrl('/imgs/logo.webp', '/api')).toBe('/imgs/logo.webp');
  });

  it('does not rewrite absolute URLs and returns a local placeholder for missing images', () => {
    expect(resolveImageUrl('https://cdn.example.com/product.webp', '/api')).toBe('https://cdn.example.com/product.webp');
    expect(resolveImageUrl(null, '/api')).toBe(IMAGE_PLACEHOLDER);
  });

  it('supports a separately configured API/media origin', () => {
    expect(resolveImageUrl('/uploads/product.webp', 'https://api.example.com/api')).toBe(
      'https://api.example.com/api/uploads/product.webp',
    );
  });
});
