import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  PlusCircle,
  Clock,
  CheckCircle,
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

const VendorTicketsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  // Form states
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
      toast.error('Failed to sync support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subject.length < 5 || message.length < 10) {
      toast.error('Subject must be at least 5 chars and message 10 chars');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/tickets', {
        subject,
        message,
        priority
      });

      toast.success('Support ticket created successfully!');
      setCreateModalOpen(false);
      setSubject('');
      setMessage('');
      setPriority('MEDIUM');
      fetchTickets();
    } catch (error: any) {
      console.error('Failed to create ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to submit support ticket');
    } finally {
      setSubmitting(false);
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
        {status.replace('_', ' ')}
      </span>
    );
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-600',
      MEDIUM: 'bg-amber-100 text-amber-700',
      HIGH: 'bg-red-100 text-red-700',
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${colors[priority]}`}>
        {priority}
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Support Tickets</h1>
          <p className="text-gray-500 text-sm mt-1">
            Need help? Contact the platform administration.
          </p>
        </div>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-purple-100 text-sm"
        >
          <PlusCircle size={16} />
          Open Support Ticket
        </button>
      </div>

      {/* Tickets List */}
      {tickets.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
            <MessageSquare size={24} className="text-gray-400" />
          </div>
          <p className="text-gray-500 font-medium">You have no active support tickets.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/vendor/tickets/${ticket.id}`}
              className="block p-5 hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="space-y-1">
                  <h4 className="font-bold text-gray-900 text-sm hover:text-purple-600 transition-colors">
                    {ticket.subject}
                  </h4>
                  <p className="text-xs text-gray-400 line-clamp-1 max-w-xl">{ticket.message}</p>
                  <p className="text-[10px] text-gray-400 pt-1">
                    Last updated:{' '}
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

      {/* Create Ticket Modal */}
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
                <MessageSquare className="text-purple-600" />
                Open Support Ticket
              </h3>
              <p className="text-gray-500 text-xs mb-6">
                Describe the problem you are experiencing. Our support team will respond to you shortly.
              </p>

              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Subject / Topic
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Brief summary of the issue..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Priority Level
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                    >
                      <option value="LOW">Low (Question/Feedback)</option>
                      <option value="MEDIUM">Medium (General Bug/Issue)</option>
                      <option value="HIGH">High (Urgent Help Needed)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Detailed Message
                  </label>
                  <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    placeholder="Describe the issue in detail..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-purple-100 text-sm disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Send size={14} />
                    {submitting ? 'Submitting...' : 'Submit Ticket'}
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

export default VendorTicketsPage;
