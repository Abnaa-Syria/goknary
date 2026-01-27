import React, { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchCompare } from '../../store/slices/compareSlice';

const CompareBadge: React.FC = () => {
  const dispatch = useAppDispatch();
  const { count, loading } = useAppSelector((state) => state.compare);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!hasFetched.current && !loading) {
      hasFetched.current = true;
      dispatch(fetchCompare());
    }
  }, [dispatch, loading]);

  if (count === 0 || loading) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default CompareBadge;

