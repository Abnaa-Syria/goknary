import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../lib/api';

const AnnouncementBar: React.FC = () => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const [announcement, setAnnouncement] = useState<{ message: string; isActive: boolean } | null>(null);

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const response = await api.get('/announcements');
        if (response.data.announcement?.isActive) {
          setAnnouncement(response.data.announcement);
        }
      } catch (error) {
        console.error('Failed to fetch announcement:', error);
      }
    };

    fetchAnnouncement();
  }, []);

  if (!announcement || !announcement.isActive) return null;

  const marqueeClass = isRTL ? 'animate-marquee-rtl' : 'animate-marquee';

  return (
    <div 
      className="bg-black text-white h-10 flex items-center overflow-hidden relative z-[60] select-none"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex w-full whitespace-nowrap">
        {/* We duplicate the message to ensure a seamless infinite scroll loop if the text is short */}
        <div className={`flex shrink-0 items-center gap-10 ${marqueeClass}`}>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          {/* Repeat it several times for continuous effect */}
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
        </div>
        
        {/* Secondary block to avoid gaps in the loop */}
        <div className={`flex shrink-0 items-center gap-10 ${marqueeClass} aria-hidden`}>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
          <span className="text-sm font-bold tracking-wide uppercase px-4">
            {announcement.message}
          </span>
        </div>
      </div>
    </div>
  );
};

export default AnnouncementBar;
