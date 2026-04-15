import React, { useEffect, useState } from 'react';
import { useAppSelector } from '../../store/hooks';
import api from '../../lib/api';

const WishlistBadge: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      api.get('/wishlist/count')
        .then(res => setCount(res.data.count))
        .catch(err => console.error(err));
    } else {
      setCount(0);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated || count === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-accent-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  );
};

export default WishlistBadge;

