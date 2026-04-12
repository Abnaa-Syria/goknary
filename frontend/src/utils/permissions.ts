export const hasPermission = (user: any, requiredPermission: string) => {
  if (!user) return false;
  if (user.role === 'ADMIN') return true; // Super Admin bypass

  if (user.role === 'STAFF' && user.customRole?.permissions) {
    try {
      const perms = JSON.parse(user.customRole.permissions);
      return perms.includes(requiredPermission);
    } catch (e) {
      console.error('RBAC Parse Error:', e);
      return false;
    }
  }
  return false;
};

export const getRoleTheme = (user: any) => {
  return user?.role === 'STAFF' ? {
    sidebarBg: '#064E3B', sidebarText: '#FFFFFF', navbarBg: '#059669', accent: '#10B981', badgeBg: '#D1FAE5', badgeText: '#065F46', label: user?.customRole?.name || 'STAFF WORKSPACE'
  } : {
    sidebarBg: '#1E3A5F', sidebarText: '#FFFFFF', navbarBg: '#2563EB', accent: '#3B82F6', badgeBg: '#DBEAFE', badgeText: '#1D4ED8', label: 'SUPER ADMIN'
  };
};
