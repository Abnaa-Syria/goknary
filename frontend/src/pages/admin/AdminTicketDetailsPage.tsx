import React, { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  MessageSquare,
  ArrowLeft,
  Send,
  XCircle,
  Shield,
  User,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Link, useParams, useNavigate } from 'react-router-dom';

interface Sender {
  id: string;
  name: string | null;
  role: string;
  avatar: string | null;
}

interface Message {
  id: string;
  message: string;
  createdAt: string;
  sender: Sender;
}

interface TicketDetails {
  id: string;
  subject: string;
  message: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
  messages: Message[];
}

const AdminTicketDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchTicketDetails();
  }, [id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const fetchTicketDetails = async () => {
    try {
      const response = await api.get(`/tickets/${id}`);
      setTicket(response.data.ticket);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      toast.error('Failed to sync ticket conversation thread');
      navigate('/admin/tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    setSubmitting(true);
    try {
      await api.post(`/tickets/${id}/messages`, {
        message: replyText
      });
      toast.success(t('admin.successReplySubmitted', 'Reply submitted successfully!'));
      setReplyText('');
      fetchTicketDetails();
    } catch (error: any) {
      console.error('Failed to send reply:', error);
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to send reply'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setUpdatingStatus(true);
    try {
      await api.patch(`/tickets/${id}/status`, { status });
      toast.success(t('admin.successStatusUpdated', 'Ticket status updated successfully!'));
      fetchTicketDetails();
    } catch (error: any) {
      console.error('Failed to update ticket status:', error);
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to update status'));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleUpdatePriority = async (priority: string) => {
    try {
      await api.patch(`/tickets/${id}/status`, { priority });
      toast.success(t('admin.successPriorityUpdated', 'Ticket priority updated successfully!'));
      fetchTicketDetails();
    } catch (error: any) {
      console.error('Failed to update priority:', error);
      toast.error(error.response?.data?.error || t('messages.errorOccurred', 'Failed to update priority'));
    }
  };

  if (loading || !ticket) {
    return (
      <div className="space-y-6">
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-[75vh] text-start">
      {/* Header breadcrumb & actions */}
      <div className="flex items-center justify-between flex-shrink-0 border-b border-gray-100 pb-4">
        <Link
          to="/admin/tickets"
          className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft size={14} className="flip-rtl" />
          {t('admin.backToTickets', 'Back to Tickets')}
        </Link>
      </div>

      {/* Main Ticket Info Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex-shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="space-y-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('admin.ticketSubject', 'Subject')}</span>
            <h3 className="text-xl font-bold text-gray-900 leading-tight">{ticket.subject}</h3>
            <p className="text-xs text-gray-500 font-medium">
              {t('admin.ticketOpenedBy', 'Opened by:')} <span className="font-bold text-gray-700">{ticket.user.name || 'Anonymous'}</span> ({ticket.user.email}) —{' '}
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-black uppercase">
                {ticket.user.role}
              </span>
            </p>
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('admin.ticketStatus', 'Status')}</label>
              <select
                value={ticket.status}
                disabled={updatingStatus}
                onChange={(e) => handleUpdateStatus(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="OPEN">{t('admin.ticketStatusOpen', 'Open')}</option>
                <option value="IN_PROGRESS">{t('admin.ticketStatusInProgress', 'In Progress')}</option>
                <option value="RESOLVED">{t('admin.ticketStatusResolved', 'Resolved')}</option>
                <option value="CLOSED">{t('admin.ticketStatusClosed', 'Closed')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{t('admin.ticketPriority', 'Priority')}</label>
              <select
                value={ticket.priority}
                onChange={(e) => handleUpdatePriority(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="LOW">{t('admin.priorityLow', 'Low')}</option>
                <option value="MEDIUM">{t('admin.priorityMedium', 'Medium')}</option>
                <option value="HIGH">{t('admin.priorityHigh', 'High')}</option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
          {ticket.message}
        </p>
      </div>

      {/* Conversation Thread */}
      <div className="flex-1 min-h-0 bg-gray-50/50 rounded-3xl border border-gray-100 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        {ticket.messages.length === 0 ? (
          <div className="my-auto text-center p-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 border border-gray-100 shadow-sm">
              <MessageSquare size={20} className="text-gray-400" />
            </div>
            <p className="text-xs text-gray-400 font-medium">{t('admin.noRepliesYet', 'No replies in thread yet. Type below to send the first response.')}</p>
          </div>
        ) : (
          ticket.messages.map((msg) => {
            const isAgent = msg.sender.role === 'ADMIN' || msg.sender.role === 'STAFF';
            // In Admin dashboard, the Agent replies are "self" (sent from admin team, styled on the right), and user replies are on the left.
            const isSelf = isAgent;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[80%] ${!isSelf ? 'self-start text-start' : 'self-end flex-row-reverse text-end'}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full border border-gray-100 bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  {!isSelf ? (
                    <User size={14} className="text-gray-500" />
                  ) : (
                    <Shield size={14} className="text-purple-600" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1">
                  <div className={`text-[10px] font-bold text-gray-400 ${isSelf ? 'text-end' : ''}`}>
                    {msg.sender.name || 'User'} {!isSelf && <span className="bg-gray-150 text-gray-700 text-[8px] font-black rounded-full px-1.5 py-0.2 ml-1 uppercase">{msg.sender.role}</span>}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      !isSelf
                        ? 'bg-white text-gray-800 rounded-ss-none border border-gray-100'
                        : 'bg-purple-600 text-white rounded-se-none'
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.message}</p>
                  </div>
                  <div className="text-[9px] text-gray-400 font-medium">
                    {new Date(msg.createdAt).toLocaleTimeString(i18n.language, {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input box */}
      <div className="flex-shrink-0">
        {ticket.status === 'CLOSED' ? (
          <div className="flex gap-3 items-center justify-center p-4 bg-gray-100 rounded-2xl text-xs font-semibold text-gray-500">
            <AlertCircle size={14} />
            {t('admin.ticketClosedNotice', 'This ticket is closed. Reopen it from status dropdown to reply.')}
          </div>
        ) : (
          <form onSubmit={handleSendReply} className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={t('admin.replyPlaceholder', 'Type your official support response here...')}
              required
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-sm transition-all"
            />
            <button
              type="submit"
              disabled={submitting || !replyText.trim()}
              className="p-3 bg-purple-600 text-white rounded-2xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100 disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AdminTicketDetailsPage;
