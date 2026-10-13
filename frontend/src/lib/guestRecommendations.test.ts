import { beforeEach, describe, expect, it } from '@jest/globals';
import { GUEST_RECOMMENDATION_STORAGE_KEY, getGuestRecommendationContext, recordGuestInterest } from './guestRecommendations';

describe('guest recommendation profile', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the most recent view first and de-duplicates ids', () => {
    recordGuestInterest('PRODUCT_VIEW', 'p1', 1000);
    recordGuestInterest('PRODUCT_VIEW', 'p2', 2000);
    recordGuestInterest('PRODUCT_VIEW', 'p1', 3000);
    expect(getGuestRecommendationContext(3000).productIds).toEqual(['p1', 'p2']);
  });

  it('drops expired and corrupt stored interests safely', () => {
    localStorage.setItem(GUEST_RECOMMENDATION_STORAGE_KEY, JSON.stringify({ products: [{ id: 'old', at: 1 }], categories: 'invalid' }));
    expect(getGuestRecommendationContext(91 * 24 * 60 * 60 * 1000).productIds).toEqual([]);
    expect(getGuestRecommendationContext(1000).categoryIds).toEqual([]);
  });
});
