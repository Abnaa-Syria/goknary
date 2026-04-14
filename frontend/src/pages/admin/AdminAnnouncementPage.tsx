import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Save, Loader2, Sparkles, Power } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const AdminAnnouncementPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [data, setData] = useState({
    message: '',
    isActive: true,
  });

  useEffect(() => {
    const fetchAnnouncement = async () => {
      try {
        const response = await api.get('/announcements');
        if (response.data.announcement) {
          setData({
            message: response.data.announcement.message,
            isActive: response.data.announcement.isActive,
          });
        }
      } catch (error) {
        console.error('Failed to fetch announcement config:', error);
      } finally {
        setFetching(false);
      }
    };
    fetchAnnouncement();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/admin/announcements', data);
      toast.success(t('admin.announcementPage.updateSuccess'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('admin.announcementPage.updateFailed'));
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
          <Megaphone className="text-primary-600" size={32} />
          {t('admin.announcementPage.title')}
        </h1>
        <p className="text-gray-500 mt-1 text-sm tracking-wide">{t('admin.announcementPage.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2">
          <section className="bg-white rounded-[40px] border border-gray-100 shadow-2xl shadow-gray-200/50 overflow-hidden">
            <div className="p-8 border-b border-gray-50 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-600 text-white rounded-2xl shadow-lg shadow-primary-200">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-gray-900 uppercase tracking-tighter">{t('admin.announcementPage.contentTitle')}</h2>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">{t('admin.announcementPage.contentSubtitle')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setData({ ...data, isActive: !data.isActive })}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${data.isActive
                    ? 'bg-green-100 text-green-700 ring-2 ring-green-500/20'
                    : 'bg-gray-100 text-gray-500'
                  }`}
              >
                <Power size={14} />
                {data.isActive ? t('admin.announcementPage.active') : t('admin.announcementPage.disabled')}
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-10 space-y-8">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-gray-400 ms-1">{t('admin.announcementPage.messageLabel')}</label>
                  <textarea
                    value={data.message}
                    onChange={(e) => setData({ ...data, message: e.target.value })}
                    className="w-full h-32 px-6 py-4 bg-gray-50 border border-transparent rounded-3xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary-500/10 focus:bg-white focus:border-primary-500 transition-all resize-none"
                    placeholder={t('admin.announcementPage.messagePlaceholder')}
                    required
                  />
                  <div className="flex justify-between items-center px-2">
                    <p className="text-[10px] text-gray-400 italic">{t('admin.announcementPage.messageHint')}</p>
                    <span className={`text-[10px] font-bold ${data.message.length > 200 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {t('admin.announcementPage.characters', { count: data.message.length })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-8 py-5 bg-gray-900 text-white font-black uppercase tracking-[0.2em] text-xs rounded-3xl hover:bg-gray-800 disabled:opacity-50 active:scale-[0.98] transition-all shadow-2xl shadow-gray-200"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {t('admin.announcementPage.updateButton')}
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-primary-600 rounded-[40px] p-8 text-white shadow-2xl shadow-primary-200 relative overflow-hidden group">
            <div className="absolute -end-10 -bottom-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
              <Megaphone size={200} />
            </div>
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <Sparkles size={24} />
              {t('admin.announcementPage.proTipTitle')}
            </h3>
            <p className="text-sm font-medium leading-relaxed opacity-90">
              {t('admin.announcementPage.proTipContent')}
            </p>
          </div>

          <div className="bg-white rounded-[40px] border border-gray-100 p-8 shadow-xl shadow-gray-100/50">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">{t('admin.announcementPage.livePreview')}</h3>
            <div className="bg-black rounded-2xl h-10 flex items-center overflow-hidden relative">
              <div className="flex animate-marquee whitespace-nowrap">
                <span className="text-[10px] font-bold text-white uppercase px-4">{data.message || t('admin.announcementPage.noMessage')}</span>
                <span className="text-[10px] font-bold text-white uppercase px-4">{data.message || t('admin.announcementPage.noMessage')}</span>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-4 text-center italic">{t('admin.announcementPage.previewCaption')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnnouncementPage;
