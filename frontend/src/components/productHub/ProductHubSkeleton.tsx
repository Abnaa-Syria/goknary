import React from 'react';

export const ProductHubSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
        <div className="flex items-center gap-5">
          <div className="w-24 h-24 bg-gray-200 rounded-xl" />
          <div className="space-y-2 flex-1">
            <div className="h-7 w-64 bg-gray-200 rounded" />
            <div className="h-4 w-48 bg-gray-100 rounded" />
            <div className="h-5 w-24 bg-gray-100 rounded-full" />
          </div>
        </div>
      </div>

      {/* KPI Grid Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 h-24 space-y-2">
            <div className="h-3 w-16 bg-gray-200 rounded" />
            <div className="h-6 w-20 bg-gray-200 rounded" />
            <div className="h-2.5 w-12 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Overview Card Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 h-48">
        <div className="h-5 w-48 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 h-64">
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
};
