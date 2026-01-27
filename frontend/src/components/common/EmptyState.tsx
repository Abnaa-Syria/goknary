import React from 'react';
import { Link } from 'react-router-dom';
import { FiPackage } from 'react-icons/fi';

interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel?: string;
  actionLink?: string;
  icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  actionLabel,
  actionLink,
  icon,
}) => {
  return (
    <div className="card p-12 text-center">
      <div className="text-gray-400 mb-4 flex justify-center">
        {icon || <FiPackage className="w-16 h-16" />}
      </div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{message}</p>
      {actionLabel && actionLink && (
        <Link to={actionLink} className="btn-primary inline-block">
          {actionLabel}
        </Link>
      )}
    </div>
  );
};

export default EmptyState;

