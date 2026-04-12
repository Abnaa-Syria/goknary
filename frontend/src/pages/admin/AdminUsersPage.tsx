import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  ShieldAlert, 
  Key, 
  User as UserIcon,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Ban,
  ChevronDown,
  Loader2,
  X,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  Lock as LockIcon,
  Plus,
  Shield,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { EmptyState } from './DashboardComponents';

// --- Types ---

type UserRole = 'CUSTOMER' | 'VENDOR' | 'STAFF' | 'ADMIN';
type VendorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

interface CustomRoleRef {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  vendor?: {
    id: string;
    storeName: string;
    status: VendorStatus;
  } | null;
  customRole?: CustomRoleRef | null;
}

// --- Sub-components ---

const StatusBadge: React.FC<{ status?: VendorStatus; role: UserRole }> = ({ status, role }) => {
  if (role !== 'VENDOR' || !status) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500">
        <UserCheck size={12} />
        Active
      </span>
    );
  }

  const styles = {
    PENDING: 'bg-yellow-50 text-yellow-600 border-yellow-100',
    APPROVED: 'bg-green-50 text-green-600 border-green-100',
    REJECTED: 'bg-red-50 text-red-600 border-red-100',
    SUSPENDED: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  const icons = {
    PENDING: <Clock size={12} />,
    APPROVED: <CheckCircle size={12} />,
    REJECTED: <XCircle size={12} />,
    SUSPENDED: <Ban size={12} />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {icons[status]}
      {status}
    </span>
  );
};

const RoleBadge: React.FC<{ role: UserRole; customRoleName?: string }> = ({ role, customRoleName }) => {
  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-red-50 text-red-600 border-red-100',
    STAFF: 'bg-amber-50 text-amber-700 border-amber-100',
    VENDOR: 'bg-purple-50 text-purple-600 border-purple-100',
    CUSTOMER: 'bg-blue-50 text-blue-600 border-blue-100',
  };

  if (role === 'STAFF' && customRoleName) {
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border ${styles.STAFF}`}>
          <Shield size={10} />
          STAFF
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-[10px] font-bold border border-amber-100">
          {customRoleName}
        </span>
      </div>
    );
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tighter border ${styles[role]}`}>
      {role}
    </span>
  );
};

// --- Page Component ---

const AdminUsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | VendorStatus>('all');

  // Modals State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => { 
    try {
      setLoading(true);
      const response = await api.get('/admin/users');
      setUsers(response.data.users);
    } catch (error: any) {
      toast.error('Failed to sync user ecosystem');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        user.email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      
      const matchesStatus = 
        statusFilter === 'all' || 
        (user.vendor?.status === statusFilter);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  if (loading) return <UsersTableSkeleton />;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex-1 relative group">
          <label className="sr-only">Search users</label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search by identity or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select 
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="all">All Roles</option>
              <option value="ADMIN">Admins Only</option>
              <option value="STAFF">Staff Only</option>
              <option value="VENDOR">Vendors Only</option>
              <option value="CUSTOMER">Customers Only</option>
            </select>
          </div>

          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button 
            onClick={fetchUsers}
            className="p-2 bg-gray-50 text-gray-500 hover:text-gray-900 rounded-xl border border-gray-200 flex items-center justify-center transition-colors"
            title="Refresh Data"
          >
            <Loader2 className={loading ? 'animate-spin' : ''} size={18} />
          </button>

          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-bold text-sm rounded-xl hover:bg-primary-700 transition-all shadow-md shadow-primary-200"
          >
            <UserPlus size={16} />
            Create User
          </button>
        </div>
      </div>

      {/* Modern Data Table */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">User Identity</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Joined On</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              <AnimatePresence>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-20 text-center">
                      <EmptyState 
                        title="No identities found" 
                        message="Try adjusting your filters or search term to discover the users you're looking for." 
                      />
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <motion.tr 
                      key={user.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-gray-50/50 transition-colors group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${
                            user.role === 'ADMIN' ? 'bg-red-50 text-red-600 border-red-100' : 
                            user.role === 'STAFF' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            user.role === 'VENDOR' ? 'bg-purple-50 text-purple-600 border-purple-100' : 
                            'bg-blue-50 text-blue-600 border-blue-100'
                          }`}>
                            {user.name?.charAt(0) || user.email.charAt(0)}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-gray-900 leading-none">{user.name || 'Anonymous User'}</span>
                            <span className="text-xs text-gray-400 font-medium mt-1">{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <RoleBadge role={user.role} customRoleName={user.customRole?.name} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={user.vendor?.status} role={user.role} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                        {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end">
                          <ActionMenu 
                            onEdit={() => { setSelectedUser(user); setIsEditModalOpen(true); }}
                            onPassword={() => { setSelectedUser(user); setIsPasswordModalOpen(true); }}
                          />
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        <div className="p-4 bg-gray-50/30 border-t border-gray-100 flex justify-between items-center">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
              Total Personnel: {filteredUsers.length}
            </p>
        </div>
      </section>

      {/* --- Modals --- */}
      
      <EditUserModal 
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        user={selectedUser}
        onSuccess={fetchUsers}
      />

      <ResetPasswordModal 
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        user={selectedUser}
      />

      <CreateUserModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchUsers}
      />
    </div>
  );
};

// --- Sub-components (Table Utilities) ---

const ActionMenu: React.FC<{ onEdit: () => void; onPassword: () => void }> = ({ onEdit, onPassword }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Aligned to the right of the button, appearing below it
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 192, // w-48 is 192px
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      calculatePosition();
      
      const handleScroll = () => setIsOpen(false);
      const handleClickOutside = (e: MouseEvent) => {
        if (
          menuRef.current && !menuRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      // Use capture phase for scroll to catch it from anywhere in the tree
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      document.addEventListener('mousedown', handleClickOutside);

      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isOpen, calculatePosition]);

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={`p-2 rounded-lg transition-all ${isOpen ? 'bg-primary-50 text-primary-600' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
      >
        <MoreVertical size={16} />
      </button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] pointer-events-none">
              <motion.div 
                ref={menuRef}
                initial={{ opacity: 0, scale: 0.95, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{ 
                  position: 'fixed',
                  top: menuPosition.top,
                  left: menuPosition.left,
                  pointerEvents: 'auto'
                }}
                className="w-48 bg-white border border-gray-100 rounded-xl shadow-2xl py-2 overflow-hidden ring-1 ring-black/5"
              >
                <button 
                  onClick={() => { onEdit(); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-primary-50 hover:text-primary-700 transition-colors group"
                >
                  <Edit2 size={14} className="text-gray-400 group-hover:text-primary-500" />
                  <span className="font-semibold">Manage Profile</span>
                </button>
                <button 
                  onClick={() => { onPassword(); setIsOpen(false); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-yellow-50 hover:text-yellow-700 transition-colors group"
                >
                  <Key size={14} className="text-gray-400 group-hover:text-yellow-500" />
                  <span className="font-semibold">Force Password</span>
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
};

const UsersTableSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="h-16 bg-white rounded-2xl border border-gray-100"></div>
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="h-16 border-b border-gray-50 flex items-center px-6 gap-8">
          <div className="w-10 h-10 bg-gray-100 rounded-full"></div>
          <div className="flex-1 h-3 bg-gray-50 rounded"></div>
          <div className="w-20 h-4 bg-gray-50 rounded"></div>
          <div className="w-24 h-4 bg-gray-50 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

// --- Create User Modal ---

const CreateUserModal: React.FC<{ isOpen: boolean; onClose: () => void; onSuccess: () => void }> = ({
  isOpen, onClose, onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CUSTOMER' as UserRole,
    customRoleId: '',
  });

  // Fetch custom roles when STAFF is selected
  useEffect(() => {
    if (formData.role === 'STAFF') {
      api.get('/admin/roles').then((res) => {
        setAvailableRoles(res.data.roles || []);
      }).catch(() => {
        toast.error('Failed to load custom roles');
      });
    }
  }, [formData.role]);

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'CUSTOMER', customRoleId: '' });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (formData.role === 'STAFF' && !formData.customRoleId) {
      toast.error('Please select a custom role for the staff member');
      return;
    }

    setLoading(true);
    try {
      const payload: any = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      };
      if (formData.role === 'STAFF') {
        payload.customRoleId = formData.customRoleId;
      }

      await api.post('/admin/users', payload);
      toast.success(`User "${formData.name}" created successfully`);
      handleClose();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={handleClose} 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
          >
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-primary-50/30">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 text-primary-600 rounded-xl"><UserPlus size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Create New User</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Provision Account Identity</p>
                </div>
              </div>
              <button onClick={handleClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-5">
              {/* Name */}
              <div className="group">
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1 group-focus-within:text-primary-600 transition-colors">Full Name *</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input 
                    type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="John Smith"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div className="group">
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1 group-focus-within:text-primary-600 transition-colors">Email Address *</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input 
                    type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                    placeholder="user@goknary.com"
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-medium"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="group">
                <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1 group-focus-within:text-primary-600 transition-colors">Initial Password *</label>
                <div className="relative">
                  <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                  <input 
                    type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})}
                    placeholder="••••••••"
                    minLength={8}
                    className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>
                <p className="text-[10px] text-gray-400 mt-1 ms-1 font-medium">Minimum 8 characters. User will skip phone verification.</p>
              </div>

              {/* Role + Custom Role */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1">Platform Role *</label>
                  <select 
                    value={formData.role} 
                    onChange={(e) => setFormData({...formData, role: e.target.value as UserRole, customRoleId: ''})}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="VENDOR">Vendor</option>
                    <option value="STAFF">Staff (Custom Role)</option>
                    <option value="ADMIN">Super Admin</option>
                  </select>
                </div>

                <AnimatePresence>
                  {formData.role === 'STAFF' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <label className="block text-xs font-bold text-amber-600 mb-1.5 uppercase tracking-widest ms-1 flex items-center gap-1.5">
                        <Shield size={12} />
                        Assign Custom Role *
                      </label>
                      {availableRoles.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 font-medium">
                          <Loader2 className="animate-spin" size={14} />
                          Loading available roles...
                        </div>
                      ) : (
                        <select 
                          value={formData.customRoleId}
                          onChange={(e) => setFormData({...formData, customRoleId: e.target.value})}
                          className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer text-amber-800"
                          required
                        >
                          <option value="">— Select a role —</option>
                          {availableRoles.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      )}
                      <p className="text-[10px] text-amber-500 mt-1.5 ms-1 font-bold">
                        This determines the user's granular CRUD permissions in the admin panel.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {formData.role === 'ADMIN' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl">
                        <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={16} />
                        <p className="text-xs text-red-700 font-medium leading-relaxed">
                          <strong className="font-black">Super Admin</strong> bypasses all permission checks and has unrestricted access to every resource. Use this role sparingly.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-xl shadow-gray-200 group"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <UserPlus size={20} className="group-hover:scale-110 transition-transform" />}
                <span>Provision User Account</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Edit User Modal ---

const EditUserModal: React.FC<{ isOpen: boolean; onClose: () => void; user: User | null; onSuccess: () => void }> = ({ 
  isOpen, onClose, user, onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<{ id: string; name: string }[]>([]);
  const [formData, setFormData] = useState({ name: '', email: '', role: 'CUSTOMER' as UserRole, status: 'PENDING' as VendorStatus, customRoleId: '' });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        role: user.role,
        status: user.vendor?.status || 'PENDING',
        customRoleId: user.customRole?.id || '',
      });
    }
  }, [user]);

  // Fetch custom roles when STAFF is selected
  useEffect(() => {
    if (formData.role === 'STAFF') {
      api.get('/admin/roles').then((res) => {
        setAvailableRoles(res.data.roles || []);
      }).catch(() => {});
    }
  }, [formData.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const payload: any = { name: formData.name, email: formData.email, role: formData.role };
      if (formData.role === 'STAFF') {
        payload.customRoleId = formData.customRoleId;
      }
      
      // 1. Update general user profile
      await api.patch(`/admin/users/${user.id}`, payload);
      
      // 2. If it's a vendor, update status
      if (formData.role === 'VENDOR' && user.vendor?.id) {
        await api.patch(`/admin/vendors/${user.vendor.id}/status`, { status: formData.status });
      }

      toast.success('Identity state updated');
      onSuccess();
      onClose();
    } catch (error: any) {
      toast.error('Failed to sync changes');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} 
          />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
          >
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-100 text-primary-600 rounded-xl"><Edit2 size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 leading-tight">Edit Identity</h3>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Access Level & Role</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="group">
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1 group-focus-within:text-primary-600 transition-colors">Identification Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                    <input 
                      type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div className="group">
                  <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1 group-focus-within:text-primary-600 transition-colors">Primary Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-600 transition-colors" size={18} />
                    <input 
                      type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1">Ecosystem Role</label>
                    <select 
                      value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value as any, customRoleId: ''})}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                    >
                      <option value="CUSTOMER">Customer</option>
                      <option value="VENDOR">Vendor</option>
                      <option value="STAFF">Staff</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </div>

                  <AnimatePresence>
                    {formData.role === 'VENDOR' && (
                      <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-widest ms-1">Status State</label>
                        <select 
                          value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all cursor-pointer"
                        >
                          <option value="PENDING">Pending</option>
                          <option value="APPROVED">Approved</option>
                          <option value="SUSPENDED">Suspended</option>
                          <option value="REJECTED">Rejected</option>
                        </select>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Dynamic Custom Role dropdown for STAFF */}
                <AnimatePresence>
                  {formData.role === 'STAFF' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                      <label className="block text-xs font-bold text-amber-600 mb-1.5 uppercase tracking-widest ms-1 flex items-center gap-1.5">
                        <Shield size={12} />
                        Custom Role Assignment
                      </label>
                      {availableRoles.length === 0 ? (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-2xl text-xs text-amber-700 font-medium">
                          <Loader2 className="animate-spin" size={14} />
                          Loading roles...
                        </div>
                      ) : (
                        <select 
                          value={formData.customRoleId}
                          onChange={(e) => setFormData({...formData, customRoleId: e.target.value})}
                          className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all cursor-pointer text-amber-800"
                        >
                          <option value="">— Select a role —</option>
                          {availableRoles.map((role) => (
                            <option key={role.id} value={role.id}>{role.name}</option>
                          ))}
                        </select>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition-all shadow-xl shadow-gray-200 group"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldCheck size={20} className="group-hover:scale-110 transition-transform" />}
                <span>Sync Account Properties</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const ResetPasswordModal: React.FC<{ isOpen: boolean; onClose: () => void; user: User | null }> = ({ 
  isOpen, onClose, user 
}) => {
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newPassword) return;

    setLoading(true);
    try {
      await api.patch(`/admin/users/${user.id}/password`, { password: newPassword });
      toast.success('Access credentials overridden');
      setNewPassword('');
      onClose();
    } catch (error: any) {
      toast.error('Failed to override security layer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden z-10"
          >
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-red-50/30">
              <div className="flex items-center gap-3 text-red-600">
                <div className="p-2 bg-red-100 rounded-xl"><Key size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold leading-tight uppercase tracking-tight">Security Reset</h3>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">High Risk Operation</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-red-100/50 rounded-xl transition-colors"><X size={20} className="text-red-600" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 shadow-inner flex gap-3 items-start">
                <ShieldAlert className="text-red-500 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-red-700 font-medium leading-relaxed">
                  You are performing an administrative password override for <strong className="font-black underline">{user?.name || user?.email}</strong>. This bypasses all security protocols.
                </p>
              </div>

              <div className="group">
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-[0.1em] ms-1">New System Credentials</label>
                <div className="relative">
                  <LockIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-600 transition-colors" size={18} />
                  <input 
                    type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition-all font-mono"
                  />
                </div>
              </div>

              <button 
                type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 disabled:opacity-50 transition-all shadow-xl shadow-red-200"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : <ShieldAlert size={20} />}
                <span className="uppercase tracking-widest text-xs">Execute Force Reset</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AdminUsersPage;
