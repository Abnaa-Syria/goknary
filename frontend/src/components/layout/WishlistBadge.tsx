import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchWishlist } from '../../store/slices/wishlistSlice';

const WishlistBadge: React.FC = () => {
  const dispatch = useAppDispatch();
  const { count, loading } = useAppSelector((state) => state.wishlist);
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !hasFetched.current && !loading) {
      hasFetched.current = true;
      dispatch(fetchWishlist());
    }
    // Reset hasFetched when user logs out
    if (!isAuthenticated) {
      hasFetched.current = false;
    }
  }, [dispatch, isAuthenticated, loading]);

  if (!isAuthenticated || count === 0 || loading) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default WishlistBadge;

