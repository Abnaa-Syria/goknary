import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  PlusCircle,
  ChevronRight,
  Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Link } from 'react-router-dom';

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
}

const TicketsPage: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/tickets');
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error(t('account.ticketsPage.failedSyncTickets'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.length < 5 || message.length < 10) {
      toast.error(t('account.ticketsPage.ticketValidationMsg'));
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/tickets', {
        subject,
        message,
        priority
      });

      toast.success(t('account.ticketsPage.ticketCreatedSuccess'));
      setCreateModalOpen(false);
      setSubject('');
      setMessage('');
      setPriority('MEDIUM');
      fetchTickets();
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.error || t('account.ticketsPage.failedSubmitTicket'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusText = (status: Ticket['status']) => {
    switch (status) {
      case 'OPEN':
        return t('account.ticketsPage.ticketStatus.open');
      case 'IN_PROGRESS':
        return t('account.ticketsPage.ticketStatus.inProgress');
      case 'RESOLVED':
        return t('account.ticketsPage.ticketStatus.resolved');
      case 'CLOSED':
        return t('account.ticketsPage.ticketStatus.closed');
      default:
        return status;
    }
  };

  const getStatusBadge = (status: Ticket['status']) => {
    const colors = {
      OPEN: 'bg-green-50 text-green-700 border-green-200',
      IN_PROGRESS: 'bg-blue-50 text-blue-700 border-blue-200',
      RESOLVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      CLOSED: 'bg-gray-50 text-gray-600 border-gray-200',
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[status]}`}>
        {getStatusText(status)}
      </span>
    );
  };

  const getPriorityText = (ticketPriority: Ticket['priority']) => {
    switch (ticketPriority) {
      case 'LOW':
        return t('account.ticketsPage.priorityLow');
      case 'MEDIUM':
        return t('account.ticketsPage.priorityMedium');
      case 'HIGH':
        return t('account.ticketsPage.priorityHigh');
      default:
        return ticketPriority;
    }
  };

  const getPriorityBadge = (ticketPriority: Ticket['priority']) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-600',
      MEDIUM: 'bg-amber-100 text-amber-700',
      HIGH: 'bg-red-100 text-red-700',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${colors[ticketPriority]}`}>
        {getPriorityText(ticketPriority)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
            {t('account.ticketsPage.title')}
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            {t('account.ticketsPage.subtitle')}
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="btn-primary flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl transition-all text-sm font-bold"
        >
          <PlusCircle size={16} />
          {t('account.ticketsPage.openTicket')}
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">{t('account.ticketsPage.noTickets')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/account/tickets/${ticket.id}`}
              className="block p-5 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-900 text-sm group-hover:text-secondary-700 transition-colors">
                    {ticket.subject}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-1 max-w-xl">{ticket.message}</p>
                  <p className="text-[10px] text-gray-400 pt-1">
                    {t('account.ticketsPage.lastUpdated')}{' '}
                    {new Date(ticket.updatedAt).toLocaleDateString(i18n.language, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  {getStatusBadge(ticket.status)}
                  <div className="flex gap-1.5 items-center">
                    {getPriorityBadge(ticket.priority)}
                    <ChevronRight size={14} className="text-gray-400 flip-rtl" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setCreateModalOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <MessageSquare className="text-secondary-900" />
                {t('account.ticketsPage.newTicket')}
              </h3>
              <p className="text-gray-500 text-xs mb-6">
                {t('account.ticketsPage.submitTicketDesc')}
              </p>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    {t('account.ticketsPage.subject')}
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder={t('account.ticketsPage.subjectPlaceholder')}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      {t('account.ticketsPage.priorityLevel')}
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm transition-all"
                    >
                      <option value="LOW">{t('account.ticketsPage.priorityLowOption')}</option>
                      <option value="MEDIUM">{t('account.ticketsPage.priorityMediumOption')}</option>
                      <option value="HIGH">{t('account.ticketsPage.priorityHighOption')}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    {t('account.ticketsPage.detailedMessage')}
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder={t('account.ticketsPage.messagePlaceholder')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary flex-1 py-3 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} />
                    {submitting ? t('account.ticketsPage.submitting') : t('account.ticketsPage.submitTicket')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TicketsPage;
