import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from './StudioDialog';

/**
 * Warns before leaving with unsaved product changes: tab close/reload (browser prompt), in-app links
 * (intercepted before React Router handles them) and the Studio's own navigation via `leave`.
 * BrowserRouter has no navigation blocker, so the browser Back button is not intercepted.
 */
export const useUnsavedChangesGuard = (dirty: boolean) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!dirtyRef.current || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const destination = `${url.pathname}${url.search}${url.hash}`;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(destination);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  /** Navigate now, or ask first when there are unsaved changes. */
  const leave = useCallback((to: string) => {
    if (dirtyRef.current) setPending(to);
    else navigate(to);
  }, [navigate]);

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={t('productStudio.unsaved.title', 'Leave without saving?')}
      message={t('productStudio.unsaved.message', 'Your product changes have not been saved and will be lost. Variant changes that were already saved are kept.')}
      confirmLabel={t('productStudio.unsaved.leave', 'Leave without saving')}
      tone="danger"
      onCancel={() => setPending(null)}
      onConfirm={() => {
        const to = pending;
        dirtyRef.current = false;
        setPending(null);
        if (to) navigate(to);
      }}
    />
  );

  return { leave, dialog };
};
