import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  MoreHorizontal,
  RotateCcw,
  Send,
  Star,
  StarOff,
  Trash2,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CatalogActionId } from '../../lib/productCatalog';

const ACTION_ICONS: Record<CatalogActionId, LucideIcon> = {
  preview: Eye,
  viewInStore: ExternalLink,
  edit: Edit2,
  approve: Check,
  reject: X,
  submit: Send,
  resubmit: RotateCcw,
  returnToDraft: Undo2,
  hide: EyeOff,
  republish: Eye,
  sendForReview: Send,
  feature: Star,
  unfeature: StarOff,
  delete: Trash2,
};

const BUTTON_TONES: Partial<Record<CatalogActionId, string>> = {
  approve: 'bg-green-600 text-white border-green-600 hover:bg-green-700',
  reject: 'bg-white text-red-700 border-red-200 hover:bg-red-50',
  submit: 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800',
  resubmit: 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800',
};

const MENU_WIDTH = 224;

interface Props {
  actions: CatalogActionId[];
  /** How many actions are shown as buttons; the rest are in the "More actions" menu. */
  primaryCount?: number;
  onAction: (action: CatalogActionId) => void;
  busy?: boolean;
  /** Used in accessible labels, e.g. "More actions for iPhone 15". */
  productName: string;
}

/**
 * Row actions that work on touch and keyboard: the main actions are always-visible labelled buttons,
 * the others sit in a menu button (Arrow keys, Home/End, Escape). The menu is fixed-positioned so the
 * table's horizontal scroll container cannot clip it.
 */
const ProductCatalogActions: React.FC<Props> = ({ actions, primaryCount = 2, onAction, busy, productName }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const primary = actions.slice(0, primaryCount);
  const secondary = actions.slice(primaryCount);

  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    setPosition({});
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    const left = isRTL ? rect.left : rect.right - MENU_WIDTH;
    const clampedLeft = Math.max(8, Math.min(left, window.innerWidth - MENU_WIDTH - 8));
    const fitsBelow = rect.bottom + 4 + menuHeight <= window.innerHeight - 8;
    setPosition({
      position: 'fixed',
      left: clampedLeft,
      width: MENU_WIDTH,
      ...(fitsBelow ? { top: rect.bottom + 4 } : { top: Math.max(8, rect.top - 4 - menuHeight) }),
    });
  }, [open, isRTL]);

  useEffect(() => {
    if (open && position.position === 'fixed') {
      menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true });
    }
  }, [open, position]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !buttonRef.current?.contains(target)) close(false);
    };
    const onViewportChange = () => close(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, close]);

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const focusAt = (i: number) => items[(i + items.length) % items.length]?.focus();
    if (event.key === 'ArrowDown') { event.preventDefault(); focusAt(index + 1); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); focusAt(index - 1); }
    else if (event.key === 'Home') { event.preventDefault(); focusAt(0); }
    else if (event.key === 'End') { event.preventDefault(); focusAt(items.length - 1); }
    else if (event.key === 'Escape') { event.preventDefault(); close(); }
    else if (event.key === 'Tab') close(false);
  };

  const label = (action: CatalogActionId) => t(`catalog.actions.${action}`);

  return (
    <div className="flex flex-wrap items-center gap-1.5 justify-start xl:justify-end">
      {primary.map((action) => {
        const Icon = ACTION_ICONS[action];
        return (
          <button
            key={action}
            type="button"
            disabled={busy}
            onClick={() => onAction(action)}
            aria-label={`${label(action)} — ${productName}`}
            className={`inline-flex items-center gap-1.5 min-h-[40px] px-2.5 rounded-xl border text-xs font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-1 disabled:opacity-50 ${
              BUTTON_TONES[action] ?? 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Icon size={14} aria-hidden />
            <span>{label(action)}</span>
          </button>
        );
      })}
      {secondary.length > 0 && (
        <>
          <button
            ref={buttonRef}
            type="button"
            disabled={busy}
            onClick={() => (open ? close(false) : setOpen(true))}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label={t('catalog.actions.more', { name: productName })}
            className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-50"
          >
            <MoreHorizontal size={18} aria-hidden />
          </button>
          {open && (
            <div
              ref={menuRef}
              role="menu"
              aria-label={t('catalog.actions.more', { name: productName })}
              onKeyDown={onMenuKeyDown}
              style={position}
              className="z-50 rounded-xl border border-gray-100 bg-white py-1 shadow-xl text-start"
            >
              {secondary.map((action) => {
                const Icon = ACTION_ICONS[action];
                const danger = action === 'delete';
                return (
                  <button
                    key={action}
                    type="button"
                    role="menuitem"
                    tabIndex={-1}
                    onClick={() => {
                      close(false);
                      onAction(action);
                    }}
                    className={`flex w-full items-center gap-2 px-3 min-h-[44px] text-sm text-start focus:outline-none focus:bg-gray-100 hover:bg-gray-50 ${
                      danger ? 'text-red-700' : 'text-gray-800'
                    }`}
                  >
                    <Icon size={15} aria-hidden />
                    {label(action)}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProductCatalogActions;
