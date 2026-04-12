import React, { useEffect, useState } from 'react';
import {
  Shield, Plus, Edit2, Trash2, Users, Save, X, Loader2, ChevronDown, ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import {
  RESOURCES, OPERATIONS, RESOURCE_LABELS, RESOURCE_GROUPS,
  buildPermission, type Resource, type Operation,
} from '../../lib/permissions';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CustomRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

// ─── Permission Matrix Component ────────────────────────────────────────────

const PermissionMatrix: React.FC<{
  selectedPermissions: Set<string>;
  onToggle: (permission: string) => void;
  onToggleResource: (resource: Resource) => void;
  onToggleOperation: (operation: Operation) => void;
}> = ({ selectedPermissions, onToggle, onToggleResource, onToggleOperation }) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(Object.keys(RESOURCE_GROUPS))
  );

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const isResourceFullySelected = (resource: Resource) =>
    OPERATIONS.every((op) => selectedPermissions.has(buildPermission(op, resource)));

  const isOperationFullySelected = (operation: Operation) =>
    RESOURCES.every((res) => selectedPermissions.has(buildPermission(operation, res)));

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      {/* Header Row */}
      <div className="grid grid-cols-[minmax(200px,1fr)_repeat(4,80px)_80px] bg-gray-50 border-b border-gray-200">
        <div className="px-4 py-3 text-xs font-black text-gray-500 uppercase tracking-widest flex items-center">
          Resource
        </div>
        {OPERATIONS.map((op) => (
          <div key={op} className="px-2 py-3 text-center">
            <button
              type="button"
              onClick={() => onToggleOperation(op)}
              className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${
                isOperationFullySelected(op)
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              {op}
            </button>
          </div>
        ))}
        <div className="px-2 py-3 text-center">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">All</span>
        </div>
      </div>

      {/* Resource Groups */}
      {Object.entries(RESOURCE_GROUPS).map(([group, resources]) => (
        <div key={group}>
          {/* Group Header */}
          <button
            type="button"
            onClick={() => toggleGroup(group)}
            className="w-full grid grid-cols-[minmax(200px,1fr)_repeat(4,80px)_80px] bg-gray-50/50 border-b border-gray-100 hover:bg-gray-100 transition-colors"
          >
            <div className="px-4 py-2.5 text-xs font-bold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              {expandedGroups.has(group) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {group}
            </div>
          </button>

          {/* Resource Rows */}
          {expandedGroups.has(group) && resources.map((resource) => (
            <div
              key={resource}
              className="grid grid-cols-[minmax(200px,1fr)_repeat(4,80px)_80px] border-b border-gray-50 hover:bg-primary-50/20 transition-colors"
            >
              <div className="px-4 py-3 text-sm font-semibold text-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary-400" />
                {RESOURCE_LABELS[resource]}
              </div>
              {OPERATIONS.map((op) => {
                const perm = buildPermission(op, resource);
                const isChecked = selectedPermissions.has(perm);
                return (
                  <div key={op} className="flex items-center justify-center">
                    <label className="relative cursor-pointer p-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggle(perm)}
                        className="sr-only peer"
                      />
                      <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${
                        isChecked
                          ? 'bg-primary-600 border-primary-600'
                          : 'border-gray-300 bg-white hover:border-primary-400'
                      }`}>
                        {isChecked && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })}
              {/* Row "All" toggle */}
              <div className="flex items-center justify-center">
                <label className="relative cursor-pointer p-2">
                  <input
                    type="checkbox"
                    checked={isResourceFullySelected(resource)}
                    onChange={() => onToggleResource(resource)}
                    className="sr-only"
                  />
                  <div className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${
                    isResourceFullySelected(resource)
                      ? 'bg-emerald-600 border-emerald-600'
                      : 'border-gray-300 bg-white hover:border-emerald-400'
                  }`}>
                    {isResourceFullySelected(resource) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Summary */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500">
          {selectedPermissions.size} of {RESOURCES.length * OPERATIONS.length} permissions selected
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              RESOURCES.forEach((r) => OPERATIONS.forEach((o) => {
                const p = buildPermission(o, r);
                if (!selectedPermissions.has(p)) onToggle(p);
              }));
            }}
            className="text-[10px] font-bold text-primary-600 hover:underline uppercase"
          >
            Select All
          </button>
          <span className="text-gray-300">│</span>
          <button
            type="button"
            onClick={() => {
              selectedPermissions.forEach((p) => onToggle(p));
            }}
            className="text-[10px] font-bold text-red-500 hover:underline uppercase"
          >
            Clear All
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ──────────────────────────────────────────────────────────────

const AdminRolesPage: React.FC = () => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      const res = await api.get('/admin/roles');
      setRoles(res.data.roles);
    } catch (err) {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRoleName('');
    setRoleDescription('');
    setSelectedPermissions(new Set());
    setEditingRole(null);
    setShowForm(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (role: CustomRole) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setSelectedPermissions(new Set(role.permissions));
    setShowForm(true);
  };

  const handleToggle = (permission: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      next.has(permission) ? next.delete(permission) : next.add(permission);
      return next;
    });
  };

  const handleToggleResource = (resource: Resource) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const allPerms = OPERATIONS.map((op) => buildPermission(op, resource));
      const allSelected = allPerms.every((p) => next.has(p));
      allPerms.forEach((p) => (allSelected ? next.delete(p) : next.add(p)));
      return next;
    });
  };

  const handleToggleOperation = (operation: Operation) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      const allPerms = RESOURCES.map((res) => buildPermission(operation, res));
      const allSelected = allPerms.every((p) => next.has(p));
      allPerms.forEach((p) => (allSelected ? next.delete(p) : next.add(p)));
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName.trim()) { toast.error('Role name is required'); return; }
    if (selectedPermissions.size === 0) { toast.error('Select at least one permission'); return; }

    setSaving(true);
    try {
      const payload = {
        name: roleName.trim(),
        description: roleDescription.trim() || undefined,
        permissions: Array.from(selectedPermissions),
      };

      if (editingRole) {
        await api.patch(`/admin/roles/${editingRole.id}`, payload);
        toast.success(`Role "${roleName}" updated`);
      } else {
        await api.post('/admin/roles', payload);
        toast.success(`Role "${roleName}" created`);
      }

      resetForm();
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: CustomRole) => {
    if (!window.confirm(`Delete role "${role.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/roles/${role.id}`);
      toast.success(`Role "${role.name}" deleted`);
      fetchRoles();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete role');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-primary-600" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Shield className="text-primary-600" size={28} />
            Roles & Access Control
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            Define granular CRUD permissions for staff members
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold text-sm rounded-xl hover:bg-primary-700 transition-all shadow-lg shadow-primary-200"
        >
          <Plus size={18} />
          New Role
        </button>
      </div>

      {/* Role Form (Create / Edit) */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 text-primary-600 rounded-xl">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
                </h2>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-tighter">
                  Define the permission scope for this staff role
                </p>
              </div>
            </div>
            <button onClick={resetForm} className="p-2 hover:bg-gray-200 rounded-xl transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Role Name *
                </label>
                <input
                  type="text"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Data Entry, Sales Manager, Content Editor"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={roleDescription}
                  onChange={(e) => setRoleDescription(e.target.value)}
                  placeholder="Brief description of this role's responsibilities"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Permission Matrix */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                Permission Matrix *
              </label>
              <PermissionMatrix
                selectedPermissions={selectedPermissions}
                onToggle={handleToggle}
                onToggleResource={handleToggleResource}
                onToggleOperation={handleToggleOperation}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white font-bold text-sm rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-all shadow-lg shadow-primary-100"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Roles Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-start text-xs font-black text-gray-500 uppercase tracking-widest">Role Name</th>
                <th className="px-6 py-4 text-start text-xs font-black text-gray-500 uppercase tracking-widest">Description</th>
                <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Permissions</th>
                <th className="px-6 py-4 text-center text-xs font-black text-gray-500 uppercase tracking-widest">Assigned Users</th>
                <th className="px-6 py-4 text-end text-xs font-black text-gray-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {roles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <Shield className="text-gray-300 mx-auto mb-3" size={40} />
                    <p className="text-gray-400 font-medium">No custom roles defined yet</p>
                    <p className="text-xs text-gray-400 mt-1">Create your first role to start managing granular access</p>
                  </td>
                </tr>
              ) : (
                roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-600 flex items-center justify-center">
                          <Shield size={16} />
                        </div>
                        <span className="font-bold text-gray-900">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-[200px] truncate">
                      {role.description || '—'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-full">
                        {role.permissions.length} / {RESOURCES.length * OPERATIONS.length}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-sm font-bold text-gray-700">
                        <Users size={14} className="text-gray-400" />
                        {role.userCount}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-end">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditForm(role)}
                          className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all"
                          title="Edit Role"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={role.userCount > 0}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                          title={role.userCount > 0 ? 'Reassign users before deleting' : 'Delete Role'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminRolesPage;
