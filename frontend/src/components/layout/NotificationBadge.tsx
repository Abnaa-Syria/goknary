import React, { useEffect, useState, useRef } from 'react';
import { Bell, Check, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppSelector } from '../../store/hooks';
import api from '../../lib/api';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const NotificationBadge: React.FC = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      // Polling could be added here if needed
    } else {
      setUnreadCount(0);
      setNotifications([]);
      setIsOpen(false);
    }
  }, [isAuthenticated]);

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
      console.error('Failed to resolve pulse', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to resolve all pulses', error);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      // Re-calculate unread if we deleted an unread one
      const wasUnread = notifications.find(n => n.id === id)?.read === false;
      if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to delete pulse', error);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" />
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
            className="absolute end-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-dropdown border border-gray-100 py-2 z-50 overflow-hidden origin-top-right"
          >
            <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors flex items-center gap-1"
                >
                  <Check size={14} />
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-sm">
                  You are all caught up!
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      onClick={() => !notification.read && markAsRead(notification.id)}
                      className={`p-4 transition-colors cursor-pointer group ${notification.read ? 'bg-white opacity-70' : 'bg-primary-50/30'}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex-1">
                          <h4 className={`text-sm mb-1 ${notification.read ? 'font-medium text-gray-900' : 'font-bold text-primary-900'}`}>
                            {notification.title}
                          </h4>
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <span className="text-[10px] text-gray-400 mt-2 block font-medium uppercase tracking-wider">
                            {new Date(notification.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {!notification.read && <div className="w-2 h-2 rounded-full bg-primary-500 mt-1" />}
                          <button 
                            onClick={(e) => deleteNotification(notification.id, e)}
                            className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 p-1"
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
