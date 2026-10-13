import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../store/hooks';
import api from '../../lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  type?: string;
  titleAr?: string | null;
  messageAr?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

interface NotificationBadgeProps {
  /** Icon color override, used by the dashboard top bars. */
  iconColor?: string;
  buttonClassName?: string;
}

// Stays well under the production API rate limit (100 requests / 15 min per IP).
const POLL_INTERVAL_MS = 60_000;

const isInternalLink = (link?: string | null): link is string =>
  !!link && link.startsWith('/') && !link.startsWith('//');

const NotificationBadge: React.FC<NotificationBadgeProps> = ({ iconColor, buttonClassName }) => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith('ar');
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const countInFlight = useRef(false);
  const listInFlight = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (countInFlight.current || document.visibilityState === 'hidden') return;
    countInFlight.current = true;
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(Number(response.data?.unreadCount) || 0);
    } catch (error) {
      console.error('Failed to fetch unread notification count', error);
    } finally {
      countInFlight.current = false;
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (listInFlight.current) return;
    listInFlight.current = true;
    setLoading(true);
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications || []);
      setUnreadCount(Number(response.data.unreadCount) || 0);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    } finally {
      listInFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setNotifications([]);
      setIsOpen(false);
      return;
    }

    refreshUnreadCount();
    const timer = window.setInterval(refreshUnreadCount, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshUnreadCount();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, refreshUnreadCount]);

  useEffect(() => {
    if (isOpen && isAuthenticated) fetchNotifications();
  }, [isOpen, isAuthenticated, fetchNotifications]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read', error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      const wasUnread = notifications.find(n => n.id === id)?.read === false;
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete notification', error);
    }
  };

  const openNotification = async (notification: Notification) => {
    if (!notification.read) await markAsRead(notification.id);
    if (isInternalLink(notification.link)) {
      setIsOpen(false);
      navigate(notification.link);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName ?? 'relative flex items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none'}
        aria-label={isAr ? 'الإشعارات' : 'Notifications'}
        style={iconColor ? { color: iconColor } : undefined}
      >
        <Bell className={iconColor ? 'w-5 h-5' : 'w-5 h-5 sm:w-6 sm:h-6 text-gray-700'} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute end-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-dropdown border border-gray-100 py-2 z-50 overflow-hidden origin-top-right text-start"
          >
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900">{isAr ? 'الإشعارات' : 'Notifications'}</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  {isAr ? 'تحديد الكل كمقروء' : 'Mark all read'}
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  {loading
                    ? (isAr ? 'جاري التحميل...' : 'Loading...')
                    : (isAr ? 'مفيش إشعارات جديدة' : 'You are all caught up!')}
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      onClick={() => openNotification(notification)}
                      className={`p-4 transition-colors cursor-pointer group hover:bg-gray-50 ${notification.read ? 'bg-white opacity-70' : 'bg-primary-50/30'}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className={`text-sm mb-1 ${notification.read ? 'font-medium text-gray-900' : 'font-bold text-primary-900'}`}>
                            {(isAr && notification.titleAr) || notification.title}
                          </h4>
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {(isAr && notification.messageAr) || notification.message}
                          </p>
                          <span className="text-[10px] text-gray-400 mt-2 block font-medium tracking-wider">
                            {new Date(notification.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {!notification.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1" />}
                          <button 
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="text-gray-300 hover:text-red-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100 p-1"
                            aria-label={isAr ? 'حذف الإشعار' : 'Delete notification'}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBadge;
