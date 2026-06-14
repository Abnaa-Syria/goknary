import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wallet, 
  ArrowUpRight, 
  History, 
  Clock, 
  CheckCircle, 
  XCircle, 
  DollarSign, 
  AlertCircle,
  HelpCircle,
  PlusCircle,
  Building,
  Phone,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { formatPrice } from '../../lib/utils';

interface PayoutRequest {
  id: string;
  amount: number;
  paymentMethod: string;
  paymentDetails: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string;
  createdAt: string;
}

interface WalletInfo {
  balance: number;
  pendingBalance: number;
  withdrawnAmount: number;
  pendingPayoutAmount?: number;
}

const VendorPayoutsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';

  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Form states
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [vodafoneNumber, setVodafoneNumber] = useState('');
  const [instapayAddress, setInstapayAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWalletAndPayouts();
  }, []);

  const fetchWalletAndPayouts = async () => {
    try {
      const [walletRes, payoutsRes] = await Promise.all([
        api.get('/payouts/wallet'),
        api.get('/payouts/vendor')
      ]);
      setWallet(walletRes.data);
      setPayouts(payoutsRes.data.payouts || []);
    } catch (error) {
      console.error('Failed to fetch wallet info:', error);
      toast.error(t('vendor.payouts.failedSyncWallet', 'Failed to sync wallet data'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const reqAmount = parseFloat(amount);

    if (isNaN(reqAmount) || reqAmount <= 0) {
      toast.error(t('vendor.payouts.invalidAmount', 'Please enter a valid positive amount'));
      return;
    }

    if (wallet && reqAmount > wallet.balance) {
      toast.error(t('vendor.payouts.insufficientBalance', 'Insufficient available balance for this payout request'));
      return;
    }

    // Construct payment details string based on method
    let paymentDetails = '';
    if (paymentMethod === 'BANK_TRANSFER') {
      if (!bankName || !accountNumber || !accountName) {
        toast.error(t('vendor.payouts.fillBankFields', 'Please fill in all bank transfer fields'));
        return;
      }
      paymentDetails = JSON.stringify({ bankName, accountNumber, accountName });
    } else if (paymentMethod === 'VODAFONE_CASH') {
      if (!vodafoneNumber) {
        toast.error(t('vendor.payouts.enterVodafoneNumber', 'Please enter Vodafone Cash number'));
        return;
      }
      paymentDetails = JSON.stringify({ phone: vodafoneNumber });
    } else if (paymentMethod === 'INSTAPAY') {
      if (!instapayAddress) {
        toast.error(t('vendor.payouts.enterInstapayAddress', 'Please enter Instapay GPA'));
        return;
      }
      paymentDetails = JSON.stringify({ instapayAddress });
    }

    setSubmitting(true);
    try {
      await api.post('/payouts/vendor', {
        amount: reqAmount,
        paymentMethod,
        paymentDetails
      });

      toast.success(t('vendor.payouts.requestSuccess', 'Payout request submitted successfully!'));
      setRequestModalOpen(false);
      // Reset form
      setAmount('');
      setBankName('');
      setAccountNumber('');
      setAccountName('');
      setVodafoneNumber('');
      setInstapayAddress('');
      // Refresh details
      fetchWalletAndPayouts();
    } catch (error: any) {
      console.error('Payout submission failed:', error);
      toast.error(error.response?.data?.error || t('vendor.payouts.requestFailed', 'Failed to submit payout request'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: PayoutRequest['status']) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={12} />
            {t('common.pending', 'Pending')}
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            <CheckCircle size={12} />
            {t('common.approved', 'Approved')}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <XCircle size={12} />
            {t('common.rejected', 'Rejected')}
          </span>
        );
    }
  };

  const parseDetails = (method: string, detailsStr: string) => {
    try {
      const parsed = JSON.parse(detailsStr);
      if (method === 'BANK_TRANSFER') {
        return (
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-gray-700">{parsed.bankName}</p>
            <p>{t('vendor.payouts.accountLabel', 'A/C:')} {parsed.accountNumber}</p>
            <p>{t('vendor.payouts.nameLabel', 'Name:')} {parsed.accountName}</p>
          </div>
        );
      } else if (method === 'VODAFONE_CASH') {
        return (
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-gray-700">{t('vendor.payouts.vodafoneCash', 'Vodafone Cash')}</p>
            <p>{parsed.phone}</p>
          </div>
        );
      } else if (method === 'INSTAPAY') {
        return (
          <div className="text-xs text-gray-500">
            <p className="font-semibold text-gray-700">{t('vendor.payouts.instapay', 'Instapay')}</p>
            <p>{parsed.instapayAddress}</p>
          </div>
        );
      }
    } catch {
      return <span className="text-xs text-gray-500 truncate max-w-xs block">{detailsStr}</span>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-gray-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {t('vendor.payouts.title', 'Earnings & Payouts')}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {t('vendor.payouts.subtitle', 'Manage your store wallet, withdrawals, and financial settlement status.')}
          </p>
        </div>
        <button
          onClick={() => setRequestModalOpen(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
        >
          <ArrowUpRight size={20} />
          <span>{t('vendor.payouts.requestWithdrawal', 'Request Payout')}</span>
        </button>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Available Balance */}
        <div className="relative overflow-hidden bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-3xl p-6 shadow-xl shadow-purple-100">
          <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Wallet size={24} className="text-white" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
              {t('vendor.payouts.available', 'Available')}
            </span>
          </div>
          <p className="text-xs text-purple-100 font-bold uppercase tracking-widest">{t('vendor.payouts.availableBalance', 'Available Balance')}</p>
          <h2 className="text-3xl font-black mt-2 tracking-tight">
            {formatPrice(wallet?.balance || 0)}
          </h2>
        </div>

        {/* Pending Balance */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-yellow-50 rounded-2xl">
              <Clock size={24} className="text-yellow-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">
              {t('vendor.payouts.pending', 'Pending')}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('vendor.payouts.pendingBalance', 'Pending Settlements')}</p>
            <h2 className="text-3xl font-black mt-2 text-gray-900 tracking-tight">
              {formatPrice(wallet?.pendingBalance || 0)}
            </h2>
          </div>
        </div>

        {/* Total Withdrawn */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-green-50 rounded-2xl">
              <CheckCircle size={24} className="text-green-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              {t('vendor.payouts.withdrawn', 'Settled')}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('vendor.payouts.totalWithdrawn', 'Total Withdrawn')}</p>
            <h2 className="text-3xl font-black mt-2 text-gray-900 tracking-tight">
              {formatPrice(wallet?.withdrawnAmount || 0)}
            </h2>
          </div>
        </div>
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-50 rounded-2xl">
              <Clock size={24} className="text-blue-600" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {t('vendor.payouts.underReview', 'Under Review')}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('vendor.payouts.pendingPayouts', 'Pending Payouts')}</p>
            <h2 className="text-3xl font-black mt-2 text-gray-900 tracking-tight">
              {formatPrice(wallet?.pendingPayoutAmount || 0)}
            </h2>
          </div>
        </div>
      </div>

      {/* Info Warning */}
      <div className="flex gap-3 bg-purple-50 border border-purple-100 rounded-2xl p-4 text-purple-950 text-sm">
        <AlertCircle size={20} className="text-purple-600 flex-shrink-0" />
        <div>
          <h4 className="font-bold mb-1">{t('vendor.payouts.settlementPolicy', 'Settlement Policy')}</h4>
          <p className="text-purple-700/80 leading-relaxed text-xs">
            {t('vendor.payouts.policyDetails', 'Refunds and disputes are held in the pending balance until the order return window is closed. Available balances can be withdrawn instantly using Vodafone Cash, Instapay, or direct Bank Transfer. Payout requests are verified and settled within 24-48 business hours.')}
          </p>
        </div>
      </div>

      {/* History Section */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={18} className="text-gray-400" />
            <h3 className="text-base font-bold text-gray-900">{t('vendor.payouts.history', 'Withdrawal History')}</h3>
          </div>
        </div>

        {payouts.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <DollarSign size={24} className="text-gray-400" />
            </div>
            <p className="text-sm text-gray-500 font-medium">{t('vendor.payouts.noPayouts', 'No payout requests submitted yet.')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead className="bg-gray-50/50 text-gray-400 font-bold uppercase tracking-wider text-[10px] border-b border-gray-50">
                <tr>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.amount', 'Amount')}</th>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.method', 'Payment Method')}</th>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.details', 'Transfer Details')}</th>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.date', 'Submission Date')}</th>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.status', 'Status')}</th>
                  <th className="px-6 py-4 text-start">{t('vendor.payouts.notes', 'Admin Notes')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-black text-gray-900 text-base">{formatPrice(payout.amount)}</td>
                    <td className="px-6 py-4">
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg uppercase tracking-wider">
                        {payout.paymentMethod.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{parseDetails(payout.paymentMethod, payout.paymentDetails)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">
                      {new Date(payout.createdAt).toLocaleDateString(i18n.language, {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(payout.status)}</td>
                    <td className="px-6 py-4 text-gray-500 text-xs italic font-medium">
                      {payout.notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      <AnimatePresence>
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setRequestModalOpen(false)}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 z-10"
            >
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <PlusCircle className="text-purple-600" />
                {t('vendor.payouts.newRequestTitle', 'Submit Payout Request')}
              </h3>
              <p className="text-gray-500 text-xs mb-6">
                {t('vendor.payouts.newRequestSubtitle', 'Request a withdrawal from your available balance. Please fill transfer details carefully.')}
              </p>

              <form onSubmit={handleRequestPayout} className="space-y-4">
                {/* Available Balance Helper */}
                <div className="bg-gray-50 p-4 rounded-2xl flex items-center justify-between text-sm">
                  <span className="text-gray-500 font-medium">{t('vendor.payouts.withdrawable', 'Withdrawable Balance')}</span>
                  <span className="text-purple-600 font-black text-lg">{formatPrice(wallet?.balance || 0)}</span>
                </div>

                {/* Amount input */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('vendor.payouts.payoutAmount', 'Payout Amount (EGP)')}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={wallet?.balance || 0}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white text-base font-black transition-all"
                  />
                </div>

                {/* Transfer Channel */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">{t('vendor.payouts.paymentMethod', 'Payout Channel')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('BANK_TRANSFER')}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === 'BANK_TRANSFER'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Building size={20} />
                      <span className="text-[10px]">{t('vendor.payouts.bank', 'Bank')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('VODAFONE_CASH')}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === 'VODAFONE_CASH'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Phone size={20} />
                      <span className="text-[10px]">{t('vendor.payouts.vodafoneCash', 'Vodafone Cash')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('INSTAPAY')}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 transition-all ${
                        paymentMethod === 'INSTAPAY'
                          ? 'border-purple-600 bg-purple-50 text-purple-700 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                      }`}
                    >
                      <Layers size={20} />
                      <span className="text-[10px]">{t('vendor.payouts.instapay', 'Instapay')}</span>
                    </button>
                  </div>
                </div>

                {/* Conditional Fields */}
                <AnimatePresence mode="wait">
                  {paymentMethod === 'BANK_TRANSFER' && (
                    <motion.div
                      key="bank"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-100"
                    >
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('vendor.payouts.bankName', 'Bank Name')}</label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          required
                          placeholder={t('vendor.payouts.bankNamePlaceholder', 'e.g. CIB, QNB, NBE...')}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('vendor.payouts.accountNumberIBAN', 'Account Number / IBAN')}</label>
                        <input
                          type="text"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          required
                          placeholder={t('vendor.payouts.accountNumberPlaceholder', 'EG...')}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('vendor.payouts.beneficiaryName', 'Beneficiary Full Name')}</label>
                        <input
                          type="text"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          required
                          placeholder={t('vendor.payouts.beneficiaryPlaceholder', 'Account owner name')}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                        />
                      </div>
                    </motion.div>
                  )}

                  {paymentMethod === 'VODAFONE_CASH' && (
                    <motion.div
                      key="vodafone"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 bg-gray-50 rounded-2xl border border-gray-100"
                    >
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('vendor.payouts.mobileWalletNumber', 'Mobile Wallet Number')}</label>
                      <input
                        type="tel"
                        pattern="01[0-9]{9}"
                        value={vodafoneNumber}
                        onChange={(e) => setVodafoneNumber(e.target.value)}
                        required
                        placeholder={t('vendor.payouts.mobileWalletPlaceholder', 'e.g. 01012345678')}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </motion.div>
                  )}

                  {paymentMethod === 'INSTAPAY' && (
                    <motion.div
                      key="instapay"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="p-4 bg-gray-50 rounded-2xl border border-gray-100"
                    >
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">{t('vendor.payouts.instapayAddress', 'Instapay Address (IPA)')}</label>
                      <input
                        type="text"
                        value={instapayAddress}
                        onChange={(e) => setInstapayAddress(e.target.value)}
                        required
                        placeholder={t('vendor.payouts.instapayPlaceholder', 'name@instapay')}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Footer Buttons */}
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRequestModalOpen(false)}
                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-100 disabled:opacity-50"
                  >
                    {submitting ? t('common.submitting', 'Submitting...') : t('common.submit', 'Submit Request')}
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

export default VendorPayoutsPage;
