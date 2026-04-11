import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Truck, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface ShippingRate {
  id: string;
  governorate: string;
  cost: number;
  isActive: boolean;
}

const EGYPTIAN_GOVERNORATES = [
  'Cairo', 'Alexandria', 'Giza', 'Qalyubia', 'Port Said', 'Suez', 
  'Gharbia', 'Dakahlia', 'Ismaïlia', 'Asyut', 'Fayoum', 'Sharqia', 
  'Aswan', 'Beheira', 'Minya', 'Damietta', 'Luxor', 'Qena', 
  'Beni Suef', 'Sohag', 'Monufia', 'Red Sea', 'Wadi El-Jadid', 
  'Matrouh', 'North Sinai', 'South Sinai', 'Kafr el-Sheikh',
  'Other Governorates'
];

const AdminShippingPage: React.FC = () => {
  const { t } = useTranslation();
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    governorate: '',
    cost: 0,
    isActive: true
  });

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await api.get('/shipping');
      setRates(response.data.rates);
    } catch (error) {
      toast.error('Failed to sync shipping protocols');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    setFormData({ governorate: '', cost: 0, isActive: true });
    setModalOpen(true);
  };

  const handleOpenEditModal = (rate: ShippingRate) => {
    setEditingId(rate.id);
    setFormData({ 
      governorate: rate.governorate, 
      cost: rate.cost, 
      isActive: rate.isActive 
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // UI-level duplicate check
    if (!editingId) {
      const exists = rates.some(r => r.governorate.toLowerCase() === formData.governorate.toLowerCase());
      if (exists) {
        toast.error(`A shipping rate for ${formData.governorate} already exists. Please edit the existing one.`);
        return;
      }
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/shipping/${editingId}`, formData);
        toast.success('Logistics matrix updated');
      } else {
        await api.post('/shipping', formData);
        toast.success('New delivery node integrated');
      }
      setModalOpen(false);
      fetchRates();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Transmission failure');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Dissolve the shipping node for ${name}?`)) return;
    try {
      await api.delete(`/shipping/${id}`);
      toast.success('Node dissolved from global grid');
      fetchRates();
    } catch (error) {
      toast.error('Disintegration failure');
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Truck className="text-primary-600" />
            Logistics Governance
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage regional delivery costs & grid nodes</p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-lg shadow-primary-200"
        >
          <Plus size={20} />
          Add delivery Node
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Syncing with global logistics grid...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Governorate / Region</th>
                <th className="px-6 py-4 font-bold tracking-wider">Unit Cost (EGP)</th>
                <th className="px-6 py-4 font-bold tracking-wider">Grid Status</th>
                <th className="px-6 py-4 text-right font-bold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rates.map((rate) => (
                <tr key={rate.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-bold text-gray-800">{rate.governorate}</span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-primary-600">
                    {rate.cost.toLocaleString()} <span className="text-[10px] text-gray-400">EGP</span>
                  </td>
                  <td className="px-6 py-4">
                    {rate.isActive ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-[10px] font-black uppercase tracking-wider border border-green-100">
                        <CheckCircle size={10} />
                        Active Node
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-black uppercase tracking-wider border border-red-100">
                        <XCircle size={10} />
                        Deactivated
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button 
                      onClick={() => handleOpenEditModal(rate)}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      title="Adjust Parameters"
                    >
                      <Edit size={18} />
                    </button>
                    <button 
                      onClick={() => handleDelete(rate.id, rate.governorate)} 
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Dissolve Node"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr>
                   <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No regional delivery nodes detected in current grid.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden border border-gray-100"
            >
              <div className="p-6 border-b border-gray-50 bg-gray-50/50">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Adjust Delivery Parameters' : 'Integrate Delivery Node'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">Configure regional logistics yield and activation state</p>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Target Governorate</label>
                  <select
                    required
                    value={formData.governorate}
                    onChange={e => setFormData({ ...formData, governorate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all bg-gray-50"
                  >
                    <option value="">Select Region...</option>
                    {EGYPTIAN_GOVERNORATES.map(gov => (
                      <option key={gov} value={gov}>{gov}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Shipping Yield (Cost in EGP)</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.cost}
                      onChange={e => setFormData({ ...formData, cost: parseFloat(e.target.value) })}
                      className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono font-bold"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400">EGP</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <input
                    id="grid-active"
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="grid-active" className="text-sm font-bold text-gray-700 cursor-pointer">
                    Node Active in Logistics Grid
                  </label>
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors">
                    Abeyance
                  </button>
                  <button 
                    type="submit" 
                    disabled={saving} 
                    className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-black rounded-xl transition-all shadow-lg shadow-primary-200 disabled:opacity-50 flex items-center gap-2"
                  >
                    {saving ? 'Processing...' : (editingId ? 'Update Node' : 'Initialize Node')}
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

export default AdminShippingPage;
