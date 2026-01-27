import React, { useEffect, useState } from 'react';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

interface Analytics {
  summary: {
    totalOrders: number;
    totalSales: number;
    period: string;
  };
  ordersByStatus: Array<{
    status: string;
    count: number;
  }>;
  salesByDay: any[];
  topProducts: Array<{
    product: {
      name: string;
    } | null;
    quantitySold: number;
  }>;
}

const VendorAnalyticsPage: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get(`/vendor/analytics?period=${period}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !analytics) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Analytics</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="input-field w-auto"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="365">Last year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">Total Orders</h3>
          <p className="text-3xl font-bold">{analytics.summary.totalOrders}</p>
          <p className="text-xs text-gray-500 mt-2">Last {analytics.summary.period}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">Total Sales</h3>
          <p className="text-3xl font-bold">{formatPrice(analytics.summary.totalSales)}</p>
          <p className="text-xs text-gray-500 mt-2">Last {analytics.summary.period}</p>
        </div>

        <div className="card p-6">
          <h3 className="text-gray-600 text-sm mb-2">Average Order Value</h3>
          <p className="text-3xl font-bold">
            {analytics.summary.totalOrders > 0
              ? formatPrice(analytics.summary.totalSales / analytics.summary.totalOrders)
              : formatPrice(0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Last {analytics.summary.period}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4">Orders by Status</h3>
          <div className="space-y-3">
            {analytics.ordersByStatus.map((item) => (
              <div key={item.status} className="flex justify-between items-center">
                <span className="text-gray-600">{item.status}</span>
                <span className="font-bold">{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Products */}
        <div className="card p-6">
          <h3 className="text-lg font-bold mb-4">Top Selling Products</h3>
          <div className="space-y-3">
            {analytics.topProducts.length > 0 ? (
              analytics.topProducts.map((item, index) => (
                <div key={index} className="flex justify-between items-center">
                  <span className="text-gray-600">
                    {item.product?.name || 'Unknown Product'}
                  </span>
                  <span className="font-bold">{item.quantitySold} sold</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No sales data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorAnalyticsPage;

