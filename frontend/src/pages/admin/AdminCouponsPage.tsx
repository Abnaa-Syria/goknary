import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Tag, Trash2, Edit, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase: number | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  status: boolean;
}

const AdminCouponsPage = () => {
  const { t } = useTranslation();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Coupon>>({
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    minPurchase: null,
    maxUses: null,
    expiresAt: ''
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await api.get('/admin/coupons');
      setCoupons(response.data.coupons);
    } catch (error) {
      toast.error('Failed to load marketing artifacts');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!formData.code || !formData.discountValue) {
         toast.error("Please provide code and discount value.");
         return;
      }
      await api.post('/admin/coupons', formData);
      toast.success('Promotional artifact forged successfully!');
      setModalOpen(false);
      fetchCoupons();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to craft coupon');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Erase this promotional sequence completely?')) return;
    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Matrix parameter erased');
      fetchCoupons();
    } catch (error) {
      toast.error('Disintegration failure');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Tag className="text-primary-600" />
            Promo Governance
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage global marketing incentives</p>
        </div>
        <button
          onClick={() => {
            setFormData({ code: '', discountType: 'percentage', discountValue: 0, minPurchase: null, maxUses: null, expiresAt: '' });
            setModalOpen(true);
          }}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-sm"
        >
          <Plus size={20} />
          Create Promo
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading master matrix...</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-500 uppercase bg-gray-50/50">
              <tr>
                <th className="px-6 py-4 font-bold tracking-wider">Matrix Sequence (Code)</th>
                <th className="px-6 py-4 font-bold tracking-wider">Discount Yield</th>
                <th className="px-6 py-4 font-bold tracking-wider">Capacity Limits</th>
                <th className="px-6 py-4 font-bold tracking-wider">Lifespan Constraint</th>
                <th className="px-6 py-4 text-right font-bold tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gray-100 text-gray-800 font-mono font-bold uppercase tracking-widest text-sm shadow-inner">
                      {coupon.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium">
                    {coupon.discountType === 'percentage' 
                      ? <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">- {coupon.discountValue}%</span>
                      : <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">- ${coupon.discountValue}</span>}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <div>Used: {coupon.usedCount} {coupon.maxUses ? `/ ${coupon.maxUses}` : '(Unlimited)'}</div>
                    {coupon.minPurchase && <div className="text-xs mt-1 text-gray-400">Min Cart: ${coupon.minPurchase}</div>}
                  </td>
                  <td className="px-6 py-4">
                    {coupon.expiresAt ? (
                      <span className={`inline-flex items-center gap-1 ${new Date(coupon.expiresAt) < new Date() ? 'text-red-500' : 'text-gray-600'}`}>
                        <Calendar size={14} />
                        {new Date(coupon.expiresAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">No expiry</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-3">
                    <button onClick={() => handleDelete(coupon.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-12 text-center text-gray-500">No active promotional artifacts detected.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
                <h3 className="text-xl font-bold text-gray-900">Forge Promotional Sequence</h3>
              </div>
              
              <form onSubmit={handleCreate} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Coupon Code Sequence</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 font-mono uppercase transition-all"
                    placeholder="e.g. MEGA20"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Yield Type</label>
                    <select
                      value={formData.discountType}
                      onChange={e => setFormData({ ...formData, discountType: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Yield Value</label>
                    <input
                      type="number"
                      required
                      min="0"
                      step={formData.discountType === 'percentage' ? "1" : "0.01"}
                      value={formData.discountValue || ''}
                      onChange={e => setFormData({ ...formData, discountValue: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Max Consumption</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                      placeholder="Leave empty for unlimited"
                      value={formData.maxUses || ''}
                      onChange={e => setFormData({ ...formData, maxUses: e.target.value ? parseInt(e.target.value) : null })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Min. Cart Value</label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200"
                      placeholder="No minimum"
                      value={formData.minPurchase || ''}
                      onChange={e => setFormData({ ...formData, minPurchase: e.target.value ? parseFloat(e.target.value) : null })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Lifespan Constraint (Expiry)</label>
                  <input
                    type="datetime-local"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                    value={formData.expiresAt ? formData.expiresAt.substring(0, 16) : ''}
                    onChange={e => {
                       const val = e.target.value;
                       setFormData({ ...formData, expiresAt: val ? new Date(val).toISOString() : null });
                    }}
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3 border-t border-gray-50">
                  <button type="button" onClick={() => setModalOpen(false)} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-50 rounded-xl transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2">
                    {saving ? 'Forging...' : 'Initialize Sequence'}
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

export default AdminCouponsPage;
