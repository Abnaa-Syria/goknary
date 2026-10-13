import React, { useEffect, useState } from 'react';
import api from '../../lib/api';

interface AuditEntry {
  id: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: string | null;
  createdAt: string;
  actor?: { name?: string | null; email: string } | null;
}

const AdminAuditLogPage: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/audit-log')
      .then((response) => setEntries(response.data.entries || []))
      .catch((requestError) => setError(requestError.response?.data?.error || 'Failed to load audit log'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-gray-500">Loading audit log...</div>;
  if (error) return <div className="p-4 rounded-xl bg-red-50 text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Durable record of privileged operational and financial changes.</p>
      </div>
      <div className="bg-white border border-gray-100 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500"><tr>
            <th className="text-start px-4 py-3">Time</th><th className="text-start px-4 py-3">Actor</th>
            <th className="text-start px-4 py-3">Action</th><th className="text-start px-4 py-3">Entity</th>
            <th className="text-start px-4 py-3">Details</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map((entry) => <tr key={entry.id}>
              <td className="px-4 py-3 whitespace-nowrap">{new Date(entry.createdAt).toLocaleString()}</td>
              <td className="px-4 py-3">{entry.actor?.name || entry.actor?.email || entry.actorRole}</td>
              <td className="px-4 py-3 font-semibold">{entry.action}</td>
              <td className="px-4 py-3">{entry.entityType}{entry.entityId ? ` #${entry.entityId.slice(-8)}` : ''}</td>
              <td className="px-4 py-3 text-xs text-gray-500 max-w-md break-words">{entry.metadata || '—'}</td>
            </tr>)}
            {entries.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminAuditLogPage;

