import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Store, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  AlertCircle,
  LucideIcon,
  Search,
  Bell,
  User,
  ChevronRight,
  Menu,
  X,
  Settings,
  LogOut,
  ChevronDown,
  Languages
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

// --- Types ---

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

// --- Components ---

/**
 * Enterprise StatCard with modern aesthetic and micro-interactions
 */
export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color,
  loading 
}) => {
  const colorMap = {
    primary: 'text-primary-600 bg-primary-50 border-primary-100',
    success: 'text-green-600 bg-green-50 border-green-100',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-100',
    danger: 'text-red-600 bg-red-50 border-red-100',
    info: 'text-blue-600 bg-blue-50 border-blue-100',
  };

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm animate-pulse">
        <div className="flex justify-between items-start mb-4">
          <div className="w-10 h-10 bg-gray-100 rounded-xl"></div>
          <div className="w-16 h-4 bg-gray-100 rounded"></div>
        </div>
        <div className="w-24 h-8 bg-gray-100 rounded mb-2"></div>
        <div className="w-32 h-4 bg-gray-100 rounded"></div>
      </div>
    );
  }

  return (
    <motion.div 
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group"
    >
      <div className="flex justify-between items-start relative z-10">
        <div className={`p-3 rounded-xl border ${colorMap[color]} transition-colors duration-300`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${
            trend.isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}>
            {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}%
          </div>
        )}
      </div>

      <div className="mt-5 relative z-10">
        <h3 className="text-gray-500 text-sm font-medium mb-1 tracking-wide">{title}</h3>
        <p className="text-3xl font-bold tracking-tight text-gray-900 leading-none">
          {value}
        </p>
      </div>

      {/* Decorative background icon */}
      <div className="absolute -bottom-2 -right-2 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity duration-300 pointer-events-none rtl:left-0 rtl:right-auto">
        <Icon size={120} />
      </div>
    </motion.div>
  );
};

/**
 * Generic Top Navigation Bar for Admin and Vendor Panels
 */
export const DashboardTopNav: React.FC<{ 
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  onLogout?: () => void;
  userName?: string;
  role: 'Admin' | 'Vendor';
  title?: string;
  roleTheme?: any;
}> = ({ sidebarOpen, toggleSidebar, onLogout, userName = "User", role, title, roleTheme }) => {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    // Standard DOM mutation for instant direction switch (Tailwind logical properties support)
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const settingsPath = role === 'Admin' ? '/admin/settings' : '/vendor/settings';

  return (
    <header className="h-16 border-b border-gray-200 z-40 transition-colors duration-300" style={roleTheme ? { backgroundColor: roleTheme.navbarBg, color: '#fff' } : { backgroundColor: '#ffffff' }}>
      <div className="h-full px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleSidebar}
            className="p-2 rounded-lg transition-colors"
            style={roleTheme ? { color: '#fff' } : { color: '#9ca3af' }}
            aria-label="Toggle Sidebar"
          >
            <Menu size={20} />
          </button>
          <div className="hidden md:flex items-center text-sm font-medium tracking-wide">
            <span 
              className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold me-2`}
              style={roleTheme ? { backgroundColor: roleTheme.badgeBg, color: roleTheme.badgeText } : { backgroundColor: '#f3e8ff', color: '#9333ea' }}
            >
              {roleTheme ? roleTheme.label : t(`common.${role.toLowerCase()}`, role)}
            </span>
            <ChevronRight size={14} className="mx-2 rtl:rotate-180" style={roleTheme ? { color: 'rgba(255,255,255,0.5)' } : { color: '#d1d5db' }} />
            <span className="font-semibold" style={roleTheme ? { color: '#fff' } : { color: '#111827' }}>
              {title || t('common.dashboardTitle', { role: t(`common.${role.toLowerCase()}`, role), defaultValue: '{{role}} Dashboard' })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <div className="relative hidden sm:block">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={t('admin.dashboard.search', 'Search analytics...')} 
              className={`ps-10 pe-4 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all w-64 ${roleTheme ? 'bg-white/10 border-white/20 text-white placeholder-white/50 focus:ring-white/30' : 'bg-gray-50 border-gray-200 focus:ring-primary-500'}`}
            />
          </div>
          
          <button className="p-2 relative" style={roleTheme ? { color: '#fff' } : { color: '#9ca3af' }}>
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 rounded-full border-2" style={roleTheme ? { backgroundColor: roleTheme.accent, borderColor: roleTheme.navbarBg } : { backgroundColor: '#2563EB', borderColor: '#ffffff' }}></span>
          </button>
          
          <div className="h-8 w-px bg-gray-200 mx-1"></div>

          {/* Localization Toggle */}
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-all group"
            title={i18n.language === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
          >
            <Languages size={18} className="text-gray-400 group-hover:text-primary-500 transition-colors" />
            <span className="text-xs font-bold uppercase tracking-widest leading-none">
              {i18n.language === 'en' ? 'AR' : 'EN'}
            </span>
          </button>
          
          {/* Profile Section with Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 ps-2 cursor-pointer group p-1 rounded-xl transition-all border border-transparent shadow-sm hover:shadow-md"
              style={roleTheme ? { backgroundColor: 'rgba(255,255,255,0.1)' } : {}}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold border shadow-sm transition-transform group-hover:scale-105`}
                   style={roleTheme ? { backgroundColor: roleTheme.badgeBg, color: roleTheme.badgeText, borderColor: roleTheme.badgeBg } : { backgroundColor: '#f3e8ff', color: '#9333ea', borderColor: '#e9d5ff' }}>
                {userName.charAt(0)}
              </div>
              <div className="hidden lg:flex flex-col items-start leading-tight">
                <span className="text-sm font-bold" style={roleTheme ? { color: '#fff' } : { color: '#1f2937' }}>{userName}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={roleTheme ? { color: roleTheme.badgeText } : { color: '#9ca3af' }}>
                  {roleTheme ? roleTheme.label : t('common.roleMode', { role: t(`common.${role.toLowerCase()}`, role), defaultValue: '{{role}} Mode' })}
                </span>
              </div>
              <ChevronDown size={14} className={`transition-transform duration-300 ${showProfileMenu ? 'rotate-180' : ''}`} style={roleTheme ? { color: '#fff' } : { color: '#9ca3af' }} />
            </button>

            <AnimatePresence>
              {showProfileMenu && (
                <>
                  {/* Backdrop for closing */}
                  <div 
                    className="fixed inset-0 z-0" 
                    onClick={() => setShowProfileMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-xl shadow-gray-200/50 py-2 z-50 overflow-hidden"
                  >
                    <div className="px-4 py-3 border-b border-gray-50 mb-1">
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-1">{t('admin.dashboard.accountOptions', 'Account Options')}</p>
                      <p className="text-sm font-bold text-gray-700 truncate">{userName}</p>
                    </div>

                    <Link 
                      to={settingsPath}
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-primary-50 hover:text-primary-600 transition-colors group"
                    >
                      <div className="p-1.5 bg-gray-50 rounded-lg group-hover:bg-primary-100 transition-colors">
                        <Settings size={16} />
                      </div>
                      <span className="font-semibold">{t('admin.dashboard.profileSettings', 'Profile Settings')}</span>
                    </Link>

                    <button 
                      onClick={() => {
                        setShowProfileMenu(false);
                        if (onLogout) onLogout();
                        else navigate('/logout');
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors group text-start"
                    >
                      <div className="p-1.5 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                        <LogOut size={16} />
                      </div>
                      <span className="font-semibold">{t('common.logout', 'Logout')}</span>
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
};

export const ChartCard: React.FC<{ 
  title: string; 
  subtitle?: string; 
  children: React.ReactNode 
}> = ({ title, subtitle, children }) => (
  <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm lg:col-span-2">
    <div className="mb-6">
      <h3 className="text-lg font-bold text-gray-900">{title}</h3>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
    <div className="h-[350px] w-full">
      {children}
    </div>
  </div>
);

export const DashboardSkeleton = () => (
  <div className="space-y-8 animate-in fade-in duration-500">
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <StatCard key={i} title="" value="" icon={Users} color="primary" loading />
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 h-[450px] bg-white rounded-2xl border border-gray-100 p-6">
        <div className="w-48 h-6 bg-gray-100 rounded mb-8"></div>
        <div className="w-full h-full bg-gray-50 rounded-xl"></div>
      </div>
      <div className="h-[450px] bg-white rounded-2xl border border-gray-100 p-6">
        <div className="w-48 h-6 bg-gray-100 rounded mb-8"></div>
        <div className="w-full h-full bg-gray-50 rounded-xl"></div>
      </div>
    </div>
  </div>
);

export const EmptyState: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 text-center">
    <div className="p-4 bg-white rounded-full shadow-sm mb-4">
      <AlertCircle size={48} className="text-gray-400" />
    </div>
    <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
    <p className="text-gray-500 max-w-xs mx-auto text-sm">{message}</p>
  </div>
);

// --- Audit & Mock Helpers ---

export const auditDashboardData = (stats: any) => {
  const requiredFields = ['totalUsers', 'totalVendors', 'pendingVendors', 'totalProducts', 'totalOrders', 'totalSales'];
  const optionalTrendFields = ['revenueTrends', 'orderTrends'];

  requiredFields.forEach(field => {
    if (stats[field] === undefined || stats[field] === null) {
      console.warn(`[Admin Audit] CRITICAL: Missing data for "${field}" - UI using placeholder/zero.`);
    }
  });

  optionalTrendFields.forEach(field => {
    if (stats[field] === undefined || stats[field] === null) {
      console.warn(`[Admin Audit] POTENTIAL: Field "${field}" missing. Implementing mock data for trends.`);
    }
  });
};

