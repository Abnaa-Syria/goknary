import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { Link } from 'react-router-dom';
import { EmptyState } from './DashboardComponents';

interface Ticket {
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
    role: string;
  };
}

const AdminTicketsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await api.get('/tickets');
      setTickets(response.data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch admin tickets:', error);
      toast.error(t('messages.errorOccurred', 'Failed to sync support tickets database'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: Ticket['status']) => {
    const colors = {
      OPEN: 'bg-green-100 text-green-800 border-green-200',
      IN_PROGRESS: 'bg-blue-100 text-blue-800 border-blue-200',
      RESOLVED: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      CLOSED: 'bg-gray-100 text-gray-800 border-gray-200',
    };

    const statusText = {
      OPEN: t('admin.ticketStatusOpen', 'Open'),
      IN_PROGRESS: t('admin.ticketStatusInProgress', 'In Progress'),
      RESOLVED: t('admin.ticketStatusResolved', 'Resolved'),
      CLOSED: t('admin.ticketStatusClosed', 'Closed'),
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors[status]}`}>
        {statusText[status]}
      </span>
    );
  };

  const getPriorityBadge = (priority: Ticket['priority']) => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-600',
      MEDIUM: 'bg-amber-100 text-amber-700',
      HIGH: 'bg-red-100 text-red-700',
    };

    const priorityText = {
      LOW: t('admin.priorityLow', 'Low'),
      MEDIUM: t('admin.priorityMedium', 'Medium'),
      HIGH: t('admin.priorityHigh', 'High'),
    };

    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${colors[priority]}`}>
        {priorityText[priority]}
      </span>
    );
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(search.toLowerCase()) ||
      t.user.email.toLowerCase().includes(search.toLowerCase()) ||
      t.user.name?.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 text-start">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">{t('admin.ticketsTitle', 'Support Tickets')}</h1>
        <p className="text-gray-500 mt-1 text-sm">
          {t('admin.ticketsSubtitle', 'Audit and resolve customer and merchant support inquiries.')}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('admin.searchTicketsPlaceholder', 'Search subject, user or email...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full ps-10 pe-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold focus:outline-none pe-8"
            >
              <option value="all">{t('admin.allTicketStatuses', 'All Statuses')}</option>
              <option value="OPEN">{t('admin.openOnly', 'Open Only')}</option>
              <option value="IN_PROGRESS">{t('admin.inProgressOnly', 'In Progress Only')}</option>
              <option value="RESOLVED">{t('admin.resolvedOnly', 'Resolved Only')}</option>
              <option value="CLOSED">{t('admin.closedOnly', 'Closed Only')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200">
            <Filter size={16} className="text-gray-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold focus:outline-none pe-8"
            >
              <option value="all">{t('admin.allPriorities', 'All Priorities')}</option>
              <option value="LOW">{t('admin.priorityLow', 'Low')}</option>
              <option value="MEDIUM">{t('admin.priorityMedium', 'Medium')}</option>
              <option value="HIGH">{t('admin.priorityHigh', 'High')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        {filteredTickets.length === 0 ? (
          <EmptyState
            title={t('admin.noTickets', 'No Support Tickets')}
            message={t('admin.noTicketsDesc', 'No support tickets match the selected filters.')}
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {filteredTickets.map((ticket) => (
              <Link
                key={ticket.id}
                to={`/admin/tickets/${ticket.id}`}
                className="block p-5 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 text-sm hover:text-purple-600 transition-colors">
                        {ticket.subject}
                      </h4>
                      {getPriorityBadge(ticket.priority)}
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      {t('admin.ticketOpenedBy', 'Opened by:')} {ticket.user.name || 'Anonymous'} ({ticket.user.email}) —{' '}
                      <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-black uppercase">
                        {ticket.user.role}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400 line-clamp-1 max-w-xl">{ticket.message}</p>
                    <p className="text-[10px] text-gray-400 pt-1">
                      {t('admin.ticketUpdated', 'Updated:')}{' '}
                      {new Date(ticket.updatedAt).toLocaleDateString(i18n.language, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusBadge(ticket.status)}
                    <ChevronRight size={16} className="text-gray-400 flip-rtl" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTicketsPage;
