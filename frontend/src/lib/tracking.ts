import { useEffect, useRef } from 'react';
import api from './api';
import { useAppSelector } from '../store/hooks';
import { recordGuestInterest } from './guestRecommendations';

/**
 * First-party behavior tracking (F1). Only page views are sent from the browser; cart, wishlist,
 * search, purchase and return events are recorded by the backend itself. No third-party scripts.
 */
export type ClientTrackableEvent = 'PRODUCT_VIEW' | 'CATEGORY_VIEW';

const ENTITY_FIELD: Record<ClientTrackableEvent, 'productId' | 'categoryId'> = {
  PRODUCT_VIEW: 'productId',
  CATEGORY_VIEW: 'categoryId',
};

export const trackClientEvent = (type: ClientTrackableEvent, entityId: string): void => {
  api.post('/events', { type, [ENTITY_FIELD[type]]: entityId }).catch(() => {
    // Tracking is best-effort and must never affect the page.
  });
};

/**
 * Records one view each time the page starts showing a different entity (or is opened again) for
 * logged-in customers. Re-renders, data refetches and filter/sort/page changes of the same entity
 * never produce duplicate views. Pass `null` until the entity of the current URL has loaded.
 */
export const useTrackView = (type: ClientTrackableEvent, entityId: string | null | undefined): void => {
  const { isAuthenticated, role } = useAppSelector((state) => ({
    isAuthenticated: state.auth.isAuthenticated,
    role: state.auth.user?.role,
  }));
  const isCustomer = isAuthenticated && role === 'CUSTOMER';
  const lastTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!entityId || (isAuthenticated && !isCustomer)) return;
    const trackKey = `${type}:${entityId}`;
    if (lastTrackedRef.current === trackKey) return;
    lastTrackedRef.current = trackKey;
    if (isCustomer) trackClientEvent(type, entityId);
    else recordGuestInterest(type, entityId);
  }, [type, entityId, isAuthenticated, isCustomer]);
};
