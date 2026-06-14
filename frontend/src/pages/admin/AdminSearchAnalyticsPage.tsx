import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/hooks';
import { getRoleTheme } from '../../utils/permissions';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { RefreshCw, Search, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

interface AnalyticsData {
  topSearches: { query: string; count: number }[];
  zeroResultSearches: { query: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
}

const AdminSearchAnalyticsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAppSelector((state) => state.auth);
  const roleTheme = getRoleTheme(user);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await api.get('/admin/search-analytics');
      setData(response.data);
    } catch (error) {
      console.error('Failed to load search analytics:', error);
      toast.error(t('admin.failedToLoadAnalytics', 'Failed to load search analytics'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 rounded w-1/4"></div>
        <div className="h-[300px] bg-gray-200 rounded-2xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-[250px] bg-gray-200 rounded-2xl"></div>
          <div className="h-[250px] bg-gray-200 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  const dailyVolume = data?.dailyVolume || [];
  const topSearches = data?.topSearches || [];
  const zeroResultSearches = data?.zeroResultSearches || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Search className="w-6 h-6 text-primary-500" />
            {t('search.analyticsTitle', 'تحليلات البحث')}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {t('search.analyticsDesc', 'مراقبة الكلمات الأكثر بحثاً، حجم البحث اليومي والفرص الضائعة.')}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all shadow-md disabled:opacity-60"
          style={{ backgroundColor: roleTheme.accent }}
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          {t('common.refresh', 'تحديث')}
        </button>
      </div>

      {/* Chart: Daily search volume */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-500" />
          {t('search.dailyVolume', 'حجم البحث اليومي (آخر 30 يوماً)')}
        </h2>
        <div className="h-[300px]">
          {dailyVolume.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              {t('common.noData', 'لا توجد بيانات متاحة')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyVolume}>
                <defs>
                  <linearGradient id="searchVolumeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={roleTheme.accent} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={roleTheme.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  }}
                  labelStyle={{ fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  name={t('search.volume', 'عدد عمليات البحث')}
                  stroke={roleTheme.accent}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#searchVolumeGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Grid: Top 10 Searches & Zero Results Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Searches */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-green-500" />
            {t('search.topSearchTerms', 'أكثر كلمات البحث شيوعاً')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs font-semibold">
                  <th className="py-3 text-start font-semibold">{t('search.term', 'كلمة البحث')}</th>
                  <th className="py-3 text-end font-semibold">{t('search.searchCount', 'عدد مرات البحث')}</th>
                </tr>
              </thead>
              <tbody>
                {topSearches.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-6 text-gray-400 text-sm">
                      {t('common.noData', 'لا توجد بيانات')}
                    </td>
                  </tr>
                ) : (
                  topSearches.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <span className="w-5 h-5 bg-green-50 text-green-600 rounded-full flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {item.query}
                      </td>
                      <td className="py-3 text-sm font-bold text-gray-700 text-end">
                        {item.count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top 10 Zero-Result Searches */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm border-t-4 border-t-red-500">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 animate-pulse" />
            {t('search.zeroResultSearches', 'عمليات البحث بدون نتائج (فرص مبيعات)')}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-xs font-semibold">
                  <th className="py-3 text-start font-semibold">{t('search.term', 'كلمة البحث')}</th>
                  <th className="py-3 text-end font-semibold">{t('search.searchCount', 'عدد مرات البحث')}</th>
                </tr>
              </thead>
              <tbody>
                {zeroResultSearches.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="text-center py-6 text-gray-400 text-sm">
                      {t('common.noData', 'لا توجد بيانات')}
                    </td>
                  </tr>
                ) : (
                  zeroResultSearches.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="py-3 text-sm font-semibold text-red-600 flex items-center gap-2">
                        <span className="w-5 h-5 bg-red-50 text-red-600 rounded-full flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        {item.query}
                      </td>
                      <td className="py-3 text-sm font-bold text-gray-700 text-end">
                        {item.count.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSearchAnalyticsPage;
