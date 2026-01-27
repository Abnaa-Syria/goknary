import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchCart } from '../../store/slices/cartSlice';

const CartBadge: React.FC = () => {
  const dispatch = useAppDispatch();
  const { itemCount, loading } = useAppSelector((state) => state.cart);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current && !loading) {
      hasFetched.current = true;
      dispatch(fetchCart());
    }
  }, [dispatch, loading]);

  if (itemCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {itemCount > 9 ? '9+' : itemCount}
    </span>
  );
};

export default CartBadge;

