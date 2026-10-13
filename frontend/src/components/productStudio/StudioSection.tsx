import React from 'react';

interface SectionProps {
  id: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

export const StudioSection: React.FC<SectionProps> = ({ id, title, subtitle, badge, children }) => (
  <section id={id} aria-labelledby={`${id}-title`} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 scroll-mt-24">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id={`${id}-title`} className="text-lg font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      {badge}
    </div>
    {children}
  </section>
);

export const fieldClass = (hasError?: boolean, extra = '') =>
  `input-field w-full ${hasError ? 'border-red-400 focus:ring-red-500' : ''} ${extra}`.trim();

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

/** Label + control + hint/error; the control should use `aria-describedby={describedBy(id, …)}`. */
export const StudioField: React.FC<FieldProps> = ({ id, label, required, hint, error, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={id} className="block text-sm font-semibold text-gray-800 mb-1">
      {label}
      {required && <span className="text-red-500 ms-0.5" aria-hidden="true">*</span>}
    </label>
    {children}
    {hint && !error && <p id={`${id}-hint`} className="text-xs text-gray-500 mt-1">{hint}</p>}
    {error && <p id={`${id}-error`} className="text-xs text-red-600 mt-1 font-medium">{error}</p>}
  </div>
);

export const describedBy = (id: string, error?: string, hint?: string) =>
  (error ? `${id}-error` : hint ? `${id}-hint` : undefined);
