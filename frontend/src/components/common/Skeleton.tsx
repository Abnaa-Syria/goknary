import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
  );
};

export const ProductCardSkeleton: React.FC = () => {
  return (
    <div className="card p-4">
      <Skeleton className="w-full aspect-square mb-4" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-3 w-1/2 mb-2" />
      <Skeleton className="h-5 w-1/3" />
    </div>
  );
};

export const CategoryCardSkeleton: React.FC = () => {
  return (
    <div className="card p-4 text-center">
      <Skeleton className="w-24 h-24 rounded-full mx-auto mb-3" />
      <Skeleton className="h-4 w-20 mx-auto" />
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
};

