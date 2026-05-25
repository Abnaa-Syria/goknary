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
  AlertCircle
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
    name: string | null;
    email: string;
  };
  messages: Message[];
}

const VendorTicketDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { id } = useParams();
  const navigate = useNavigate();

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
      navigate('/vendor/tickets');
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
      toast.success('Message sent');
      setReplyText('');
      fetchTicketDetails();
    } catch (error: any) {
      console.error('Failed to send reply:', error);
      toast.error(error.response?.data?.error || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!window.confirm('Are you sure you want to close this ticket? It will mark it as resolved.')) return;

    try {
      await api.patch(`/tickets/${id}/status`, { status: 'CLOSED' });
      toast.success('Ticket closed successfully');
      fetchTicketDetails();
    } catch (error: any) {
      console.error('Failed to close ticket:', error);
      toast.error(error.response?.data?.error || 'Failed to close ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'RESOLVED':
        return 'bg-indigo-100 text-indigo-800';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
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
          to="/vendor/tickets"
          className="inline-flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft size={14} className="flip-rtl" />
          Back to Tickets
        </Link>

        {ticket.status !== 'CLOSED' && ticket.status !== 'RESOLVED' && (
          <button
            onClick={handleCloseTicket}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-all"
          >
            <XCircle size={14} />
            Close Ticket
          </button>
        )}
      </div>

      {/* Main Ticket Info Card */}
      <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h3 className="text-xl font-bold text-gray-900 leading-tight">{ticket.subject}</h3>
          <div className="flex gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusColor(ticket.status)}`}>
              {ticket.status}
            </span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-black uppercase tracking-wider">
              {ticket.priority} Priority
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 p-4 rounded-2xl border border-gray-100/50">
          {ticket.message}
        </p>
        <p className="text-[10px] text-gray-400 mt-2 font-medium">
          Opened on {new Date(ticket.createdAt).toLocaleDateString(i18n.language, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </p>
      </div>

      {/* Conversation Thread */}
      <div className="flex-1 min-h-0 bg-gray-50/50 rounded-3xl border border-gray-100 p-6 overflow-y-auto custom-scrollbar flex flex-col space-y-4">
        {ticket.messages.length === 0 ? (
          <div className="my-auto text-center p-6">
            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-2 border border-gray-100 shadow-sm">
              <MessageSquare size={20} className="text-gray-400" />
            </div>
            <p className="text-xs text-gray-400 font-medium">No replies yet. Support staff will respond to you shortly.</p>
          </div>
        ) : (
          ticket.messages.map((msg) => {
            const isAgent = msg.sender.role === 'ADMIN' || msg.sender.role === 'STAFF';

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-[80%] ${isAgent ? 'self-start text-start' : 'self-end flex-row-reverse text-end'}`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full border border-gray-100 bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                  {isAgent ? (
                    <Shield size={14} className="text-purple-600" />
                  ) : (
                    <User size={14} className="text-gray-500" />
                  )}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1">
                  <div className={`text-[10px] font-bold text-gray-400 ${isAgent ? '' : 'text-end'}`}>
                    {msg.sender.name || 'Support Agent'} {isAgent && <span className="bg-purple-100 text-purple-700 text-[8px] font-black rounded-full px-1.5 py-0.2 ml-1">AGENT</span>}
                  </div>
                  <div
                    className={`p-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                      isAgent
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
        {ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? (
          <div className="flex gap-2 items-center justify-center p-4 bg-gray-100 rounded-2xl text-xs font-semibold text-gray-500">
            <AlertCircle size={14} />
            This ticket is finalized and closed. You cannot send replies.
          </div>
        ) : (
          <form onSubmit={handleSendReply} className="flex gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Type your reply here..."
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

export default VendorTicketDetailsPage;
