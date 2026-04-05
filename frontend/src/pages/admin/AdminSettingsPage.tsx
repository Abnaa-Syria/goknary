import React from 'react';
import { useTranslation } from 'react-i18next';
import ChangePasswordSection from '../../components/account/ChangePasswordSection';

const AdminSettingsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('admin.settings')}</h2>
      <ChangePasswordSection title={t('account.changePassword')} />
    </div>
  );
};

export default AdminSettingsPage;
