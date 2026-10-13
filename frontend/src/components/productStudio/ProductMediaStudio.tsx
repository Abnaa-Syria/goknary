import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ImagePlus,
  Languages,
  Loader2,
  RefreshCw,
  Replace,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { getImageUrl } from '../../utils/image';
import { getRequestErrorMessage, uploadImages } from '../../utils/upload';
import ProductImageAltEditor from './ProductImageAltEditor';
import { StudioImage, hasCompleteAlt, nextKey } from './studioModel';

/** Same limits as the upload endpoint (backend/src/middleware/upload.ts). */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES_PER_REQUEST = 10;

interface Props {
  images: StudioImage[];
  setImages: React.Dispatch<React.SetStateAction<StudioImage[]>>;
  error?: string;
  /** Keys of images whose missing alt text blocks the requested action. */
  highlightMissingAlt?: string[];
}

const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const ProductMediaStudio: React.FC<Props> = ({ images, setImages, error, highlightMissingAlt = [] }) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const replaceTargetRef = useRef<string | null>(null);
  const filesRef = useRef(new Map<string, File>());
  const [dragOver, setDragOver] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [altTarget, setAltTarget] = useState<string | null>(null);
  const [uploadNotice, setUploadNotice] = useState('');
  const imagesRef = useRef(images);
  imagesRef.current = images;

  useEffect(() => () => {
    imagesRef.current.forEach((image) => image.previewUrl && URL.revokeObjectURL(image.previewUrl));
  }, []);

  const fileProblem = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return t('productStudio.media.badType', '{{name}}: only JPG, PNG and WebP images are accepted.', { name: file.name });
    }
    if (file.size > MAX_FILE_BYTES) {
      return t('productStudio.media.tooLarge', '{{name}} is larger than 10 MB.', { name: file.name });
    }
    return null;
  }, [t]);

  const uploadBatch = useCallback(async (entries: Array<{ key: string; file: File }>) => {
    try {
      const urls = await uploadImages(entries.map((entry) => entry.file));
      setImages((prev) => prev.map((image) => {
        const index = entries.findIndex((entry) => entry.key === image.key);
        if (index === -1) return image;
        filesRef.current.delete(image.key);
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
        return urls[index]
          ? { ...image, url: urls[index], previewUrl: null, status: 'ready' as const, error: undefined }
          : { ...image, status: 'error' as const, error: t('productStudio.media.uploadFailed', 'Upload failed') };
      }));
    } catch (uploadError) {
      const message = getRequestErrorMessage(uploadError, t('productStudio.media.uploadFailed', 'Upload failed'));
      const keys = new Set(entries.map((entry) => entry.key));
      setImages((prev) => prev.map((image) => (keys.has(image.key) ? { ...image, status: 'error' as const, error: message } : image)));
    }
  }, [setImages, t]);

  const addFiles = (incoming: FileList | File[]) => {
    const all = Array.from(incoming);
    const problems = all.map(fileProblem).filter((problem): problem is string => !!problem);
    const files = all.filter((file) => !fileProblem(file));
    setUploadNotice(problems.join(' '));
    if (files.length === 0) return;
    const entries = files.map((file) => ({ key: nextKey('img'), file }));
    entries.forEach((entry) => filesRef.current.set(entry.key, entry.file));
    setImages((prev) => [
      ...prev,
      ...entries.map((entry) => ({
        key: entry.key,
        url: null,
        previewUrl: URL.createObjectURL(entry.file),
        status: 'uploading' as const,
        altEn: '',
        altAr: '',
        isNew: true,
      })),
    ]);
    for (let i = 0; i < entries.length; i += MAX_FILES_PER_REQUEST) {
      uploadBatch(entries.slice(i, i + MAX_FILES_PER_REQUEST));
    }
  };

  const retry = (key: string) => {
    const file = filesRef.current.get(key);
    if (!file) return;
    setImages((prev) => prev.map((image) => (image.key === key ? { ...image, status: 'uploading' as const, error: undefined } : image)));
    uploadBatch([{ key, file }]);
  };

  const replace = (key: string, file: File) => {
    const problem = fileProblem(file);
    setUploadNotice(problem ?? '');
    if (problem) return;
    filesRef.current.set(key, file);
    setImages((prev) => prev.map((image) => (image.key === key
      ? { ...image, url: null, previewUrl: URL.createObjectURL(file), status: 'uploading' as const, error: undefined, isNew: true }
      : image)));
    uploadBatch([{ key, file }]);
  };

  const remove = (key: string) => {
    filesRef.current.delete(key);
    setImages((prev) => {
      const target = prev.find((image) => image.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.key !== key);
    });
  };

  const move = (from: number, to: number) => setImages((prev) => moveItem(prev, from, to));

  const altImage = images.find((image) => image.key === altTarget) ?? null;
  const altPosition = altImage ? images.indexOf(altImage) + 1 : 0;
  const srcOf = (image: StudioImage) => image.previewUrl ?? getImageUrl(image.url);

  return (
    <section id="studio-media" aria-labelledby="studio-media-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="studio-media-title" className="text-lg font-bold text-gray-900">{t('productStudio.media.title', 'Media Studio')}</h2>
          <p className="text-sm text-gray-500">
            {t('productStudio.media.subtitle', 'The first image is the main image shown in listings and search. Drag images or use the arrows to reorder.')}
          </p>
        </div>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 rounded-full px-3 py-1">
          {t('productStudio.media.count', '{{count}} images', { count: images.length })}
        </span>
      </div>

      <div
        onDragOver={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (dragIndex !== null) return;
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-gray-50'}`}
      >
        <UploadCloud className="mx-auto text-primary-500" size={28} aria-hidden="true" />
        <p className="mt-2 text-sm font-semibold text-gray-800">
          {t('productStudio.media.dropHere', 'Drop images here or')}{' '}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-primary-600 underline font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            {t('productStudio.media.browse', 'choose files')}
          </button>
        </p>
        <p className="mt-1 text-xs text-gray-500 max-w-xl mx-auto">
          {t('productStudio.media.webpNote', 'You can upload JPG, PNG or WebP (up to 10 MB each, up to 10 files at a time). Images are optimized automatically, resized to fit 1600×1600 and converted to WebP.')}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          multiple
          accept={ACCEPTED_TYPES.join(',')}
          aria-label={t('productStudio.media.browse', 'choose files')}
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <input
          ref={replaceInputRef}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={ACCEPTED_TYPES.join(',')}
          aria-label={t('productStudio.media.replace', 'Replace image')}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && replaceTargetRef.current) replace(replaceTargetRef.current, file);
            e.target.value = '';
          }}
        />
      </div>

      {uploadNotice && <p role="alert" className="text-sm text-red-600">{uploadNotice}</p>}
      {error && <p role="alert" id="studio-media-error" className="text-sm text-red-600 font-medium">{error}</p>}

      {images.length > 0 && (
        <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
          {images.map((image, index) => {
            const missingAlt = image.status === 'ready' && !hasCompleteAlt(image);
            const blocking = highlightMissingAlt.includes(image.key);
            return (
              <li
                key={image.key}
                draggable={image.status === 'ready'}
                onDragStart={(e) => {
                  setDragIndex(index);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  if (dragIndex === null) return;
                  e.preventDefault();
                  move(dragIndex, index);
                  setDragIndex(null);
                }}
                onDragEnd={() => setDragIndex(null)}
                className={`rounded-xl border bg-white overflow-hidden flex flex-col ${blocking ? 'border-red-400 ring-2 ring-red-100' : index === 0 ? 'border-primary-300 ring-2 ring-primary-100' : 'border-gray-200'} ${dragIndex === index ? 'opacity-50' : ''}`}
              >
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={srcOf(image)}
                    alt={image.altEn || image.altAr || t('productStudio.media.imageN', 'Product image {{n}}', { n: index + 1 })}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="absolute top-2 start-2 rounded-md bg-gray-900/75 text-white text-[11px] font-bold px-1.5 py-0.5">
                    {index + 1}
                  </span>
                  {index === 0 && image.status === 'ready' && (
                    <span className="absolute top-2 end-2 inline-flex items-center gap-1 rounded-full bg-primary-600 text-white text-[11px] font-bold px-2 py-0.5">
                      <Star size={11} aria-hidden="true" /> {t('productStudio.media.main', 'Main · catalog image')}
                    </span>
                  )}
                  {image.status === 'uploading' && (
                    <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center gap-1 text-sm text-gray-700" role="status">
                      <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                      {t('productStudio.media.uploading', 'Uploading and optimizing…')}
                    </div>
                  )}
                  {image.status === 'error' && (
                    <div className="absolute inset-0 bg-red-50/90 flex flex-col items-center justify-center gap-2 p-2 text-center" role="alert">
                      <span className="text-xs font-semibold text-red-700">{image.error}</span>
                      {filesRef.current.has(image.key) && (
                        <button type="button" onClick={() => retry(image.key)} className="inline-flex items-center gap-1 text-xs font-bold text-red-700 underline">
                          <RefreshCw size={12} aria-hidden="true" /> {t('productStudio.media.retry', 'Retry')}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="p-2 space-y-2">
                  {image.status === 'ready' && (
                    <button
                      type="button"
                      onClick={() => setAltTarget(image.key)}
                      className={`w-full inline-flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${missingAlt
                        ? (blocking ? 'border-red-300 bg-red-50 text-red-700' : 'border-amber-300 bg-amber-50 text-amber-800')
                        : 'border-green-200 bg-green-50 text-green-700'}`}
                    >
                      {missingAlt ? <AlertTriangle size={13} aria-hidden="true" /> : <CheckCircle2 size={13} aria-hidden="true" />}
                      {missingAlt ? t('productStudio.media.altMissing', 'Add alt text (AR/EN)') : t('productStudio.media.altDone', 'Alt text AR/EN')}
                    </button>
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(index, index - 1)}
                        disabled={index === 0}
                        className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={t('productStudio.media.moveEarlier', 'Move earlier')}
                        title={t('productStudio.media.moveEarlier', 'Move earlier')}
                      >
                        <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, index + 1)}
                        disabled={index === images.length - 1}
                        className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 disabled:opacity-30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                        aria-label={t('productStudio.media.moveLater', 'Move later')}
                        title={t('productStudio.media.moveLater', 'Move later')}
                      >
                        <ArrowRight size={15} className="rtl:rotate-180" aria-hidden="true" />
                      </button>
                      {index > 0 && image.status === 'ready' && (
                        <button
                          type="button"
                          onClick={() => move(index, 0)}
                          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          aria-label={t('productStudio.media.makeMain', 'Make main image')}
                          title={t('productStudio.media.makeMain', 'Make main image')}
                        >
                          <Star size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {image.status !== 'uploading' && (
                        <button
                          type="button"
                          onClick={() => {
                            replaceTargetRef.current = image.key;
                            replaceInputRef.current?.click();
                          }}
                          className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          aria-label={t('productStudio.media.replace', 'Replace image')}
                          title={t('productStudio.media.replace', 'Replace image')}
                        >
                          <Replace size={15} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => remove(image.key)}
                        className="p-1.5 rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                        aria-label={t('productStudio.media.remove', 'Remove image')}
                        title={t('productStudio.media.remove', 'Remove image')}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full aspect-square rounded-xl border-2 border-dashed border-gray-200 text-gray-500 hover:border-primary-300 hover:text-primary-600 flex flex-col items-center justify-center gap-1 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <ImagePlus size={22} aria-hidden="true" />
              {t('productStudio.media.addMore', 'Add images')}
            </button>
          </li>
        </ol>
      )}

      {images.some((image) => image.status === 'ready' && !image.isNew && !hasCompleteAlt(image)) && (
        <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <Languages size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          {t('productStudio.media.legacyAltWarning', 'Some existing images have no Arabic/English description. They still work (the product name is used instead), but adding a description helps accessibility and search.')}
        </p>
      )}

      <ProductImageAltEditor
        open={!!altImage}
        imageSrc={altImage ? srcOf(altImage) : null}
        position={altPosition}
        altEn={altImage?.altEn ?? ''}
        altAr={altImage?.altAr ?? ''}
        onClose={() => setAltTarget(null)}
        onSave={(alt) => {
          setImages((prev) => prev.map((image) => (image.key === altTarget ? { ...image, ...alt } : image)));
          setAltTarget(null);
        }}
      />
    </section>
  );
};

export default ProductMediaStudio;
