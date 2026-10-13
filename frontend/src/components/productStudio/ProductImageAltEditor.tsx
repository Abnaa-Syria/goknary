import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StudioDialog from './StudioDialog';
import { IMAGE_ALT_MAX_LENGTH } from './studioModel';

interface Props {
  open: boolean;
  imageSrc: string | null;
  position: number;
  altEn: string;
  altAr: string;
  onSave: (alt: { altEn: string; altAr: string }) => void;
  onClose: () => void;
}

const ProductImageAltEditor: React.FC<Props> = ({ open, imageSrc, position, altEn, altAr, onSave, onClose }) => {
  const { t } = useTranslation();
  const [draftAr, setDraftAr] = useState(altAr);
  const [draftEn, setDraftEn] = useState(altEn);

  useEffect(() => {
    if (open) {
      setDraftAr(altAr);
      setDraftEn(altEn);
    }
  }, [open, altAr, altEn]);

  return (
    <StudioDialog
      open={open}
      onClose={onClose}
      title={t('productStudio.media.altTitle', 'Image description (alt text) — image {{n}}', { n: position })}
      description={t('productStudio.media.altHelp', 'A short sentence describing what the image shows. It helps customers using screen readers and search engines; avoid lists of keywords.')}
      footer={
        <>
          <button type="button" className="btn-outline" onClick={onClose}>{t('common.cancel', 'Cancel')}</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSave({ altEn: draftEn.trim(), altAr: draftAr.trim() })}
          >
            {t('productStudio.media.altSave', 'Save description')}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1">
          {imageSrc && (
            <img src={imageSrc} alt="" className="w-full aspect-square object-cover rounded-xl border border-gray-200 bg-gray-50" />
          )}
        </div>
        <div className="sm:col-span-2 space-y-4">
          <div>
            <label htmlFor="studio-alt-ar" className="block text-sm font-semibold text-gray-800 mb-1">
              {t('productStudio.media.altAr', 'Arabic description')}
            </label>
            <textarea
              id="studio-alt-ar"
              dir="rtl"
              rows={2}
              maxLength={IMAGE_ALT_MAX_LENGTH}
              value={draftAr}
              onChange={(e) => setDraftAr(e.target.value)}
              placeholder="مثال: سماعة سوداء من الأمام"
              className="input-field w-full"
              aria-describedby="studio-alt-ar-hint"
            />
            <div className="flex justify-between gap-2 text-[11px]">
              <p id="studio-alt-ar-hint" className="text-gray-500" dir="rtl">صف الصورة باختصار كما يراها العميل، مثال: سماعة سوداء من الأمام.</p>
              <p className="text-gray-400 shrink-0">{draftAr.length}/{IMAGE_ALT_MAX_LENGTH}</p>
            </div>
          </div>
          <div>
            <label htmlFor="studio-alt-en" className="block text-sm font-semibold text-gray-800 mb-1">
              {t('productStudio.media.altEn', 'English description')}
            </label>
            <textarea
              id="studio-alt-en"
              dir="ltr"
              rows={2}
              maxLength={IMAGE_ALT_MAX_LENGTH}
              value={draftEn}
              onChange={(e) => setDraftEn(e.target.value)}
              placeholder="e.g. Black headphones, front view"
              className="input-field w-full"
              aria-describedby="studio-alt-en-hint"
            />
            <div className="flex justify-between gap-2 text-[11px]">
              <p id="studio-alt-en-hint" className="text-gray-500" dir="ltr">Describe what is visible in the image, e.g. Black headphones front view.</p>
              <p className="text-gray-400 shrink-0">{draftEn.length}/{IMAGE_ALT_MAX_LENGTH}</p>
            </div>
          </div>
        </div>
      </div>
    </StudioDialog>
  );
};

export default ProductImageAltEditor;
