import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAppSelector } from '../../store/hooks';
import { hasPermission } from '../../utils/permissions';
import { getProductDiscountFormFields } from '../../utils/discount';
import { getImageUrl, parseProductImages } from '../../utils/image';
import { CategoryLike, findCategoryPath, getCategoryLabel } from '../../utils/categoryTree';
import { getRequestErrorMessage } from '../../utils/upload';
import { isProductVisibleOnStore } from '../../utils/product';
import ProductReviewStatus from '../vendor/ProductReviewStatus';
import RejectProductModal from '../admin/RejectProductModal';
import ProductBasicInfoSection from './ProductBasicInfoSection';
import ProductOrganizationSection, { BrandOption } from './ProductOrganizationSection';
import ProductMediaStudio from './ProductMediaStudio';
import ProductTypeSelector from './ProductTypeSelector';
import { SimpleProductInventory, SimpleProductPricing } from './SimpleProductCommerce';
import VariantStudio from './VariantStudio';
import VariantEditorDialog, { VariantSubmitResult } from './VariantEditorDialog';
import VariantGeneratorDialog from './VariantGeneratorDialog';
import { mergeGenerated } from './variantModel';
import { getVariantImageAlt } from '../../utils/imageAlt';
import ProductLivePreview from './ProductLivePreview';
import { ConfirmDialog } from './StudioDialog';
import { DockAction, ProductActionDock, ProductStudioHeader, ProductValidationSummary, SummaryItem } from './ProductStudioChrome';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';
import {
  EMPTY_FORM,
  FieldErrors,
  ProductFormState,
  ProductType,
  StudioImage,
  StudioRole,
  StudioVariant,
  Translate,
  VariantDraft,
  buildImagePayload,
  checkMedia,
  getSimpleDiscountPrice,
  getVariantSummary,
  imagesFromProduct,
  mapServerErrors,
  simplePricingPayload,
  slugify,
  studioVariantFromDraft,
  validateBasics,
  validateSimpleCommerce,
  variantFromApi,
  variantPayload,
  withSingleDefault,
} from './studioModel';

type Intent = 'draft' | 'submit' | 'save' | 'hide' | 'show' | 'publish' | 'approve';

interface ProductMeta {
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  sku: string | null;
  slug: string;
  vendorId: string | null;
}

interface VendorOption {
  id: string;
  storeName: string;
}

const FIELD_TARGETS: Record<string, string> = {
  name: 'studio-name',
  nameAr: 'studio-name-ar',
  slug: 'studio-slug',
  categoryId: 'studio-category',
  brandId: 'studio-brand',
  price: 'studio-price',
  discountType: 'studio-discount-type',
  discountValue: 'studio-discount-value',
  discountPrice: 'studio-discount-value',
  stock: 'studio-stock',
  lowStockThreshold: 'studio-low-stock',
  images: 'studio-media',
  variants: 'studio-variants',
  vendorId: 'studio-vendor',
};

/** Statuses where the saved product is public or in review, so new images need alt text. */
const STRICT_SAVE_STATUSES = ['ACTIVE', 'APPROVED', 'PENDING'];

interface Props {
  role: StudioRole;
}

const ProductStudio: React.FC<Props> = ({ role }) => {
  const { t, i18n } = useTranslation();
  const tr: Translate = useCallback((key, fallback, options) => String(t(key, fallback, options as any)), [t]);
  const isRTL = i18n.language === 'ar';
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAppSelector((state) => state.auth);
  const isEdit = !!id;
  const isAdmin = role === 'admin';
  const canManageMarketplace = isAdmin && hasPermission(user, 'UPDATE_PRODUCTS');
  const canDeleteVariants = !isAdmin || hasPermission(user, 'DELETE_PRODUCTS');

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [categories, setCategories] = useState<CategoryLike[]>([]);
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [images, setImages] = useState<StudioImage[]>([]);
  const [productType, setProductType] = useState<ProductType>('SIMPLE');
  const [variants, setVariants] = useState<StudioVariant[]>([]);
  const [meta, setMeta] = useState<ProductMeta | null>(null);
  const [vendorId, setVendorId] = useState(searchParams.get('vendorId') ?? '');
  const [isPlatform, setIsPlatform] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [variantErrors, setVariantErrors] = useState<Record<number, string>>({});
  const [blockingAlt, setBlockingAlt] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [variantBusy, setVariantBusy] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ variant: StudioVariant | null } | null>(null);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<{ done: number; total: number } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'deleteVariant'; variant: StudioVariant } | { kind: 'toSimple' } | { kind: 'hide' }>(null);
  const [rejecting, setRejecting] = useState(false);

  // ─── Dirty tracking (product form only; saved variant edits are not "unsaved") ───
  const snapshot = useMemo(() => JSON.stringify({
    form,
    productType,
    images: images.map((image) => [image.url, image.status, image.altEn, image.altAr]),
    variants: isEdit ? null : variants,
    vendorId: isEdit ? null : vendorId,
    isPlatform,
  }), [form, productType, images, variants, isEdit, vendorId, isPlatform]);
  const [baseline, setBaseline] = useState<string | null>(null);
  const resetBaselineRef = useRef(false);
  useEffect(() => {
    if (resetBaselineRef.current) {
      resetBaselineRef.current = false;
      setBaseline(snapshot);
    }
  }, [snapshot, loading]);
  const dirty = baseline !== null && snapshot !== baseline;
  const { leave, dialog: unsavedDialog } = useUnsavedChangesGuard(dirty);

  const listPath = isAdmin
    ? `/admin/products${(meta?.vendorId || vendorId) ? `?vendorId=${meta?.vendorId || vendorId}` : ''}`
    : '/vendor/products';
  const editPath = (productId: string) => (isAdmin ? `/admin/products/${productId}/edit` : `/vendor/products/${productId}/edit`);

  // ─── Loading ───
  const applyProduct = useCallback((product: any) => {
    const discount = getProductDiscountFormFields(product);
    setForm({
      name: product.name ?? '',
      nameAr: product.nameAr ?? '',
      slug: product.slug ?? '',
      description: product.description ?? '',
      descriptionAr: product.descriptionAr ?? '',
      categoryId: product.categoryId ?? '',
      brandId: product.brandId ?? '',
      price: product.price != null ? String(product.price) : '',
      discountType: (discount.discountType as ProductFormState['discountType']) || '',
      discountValue: discount.discountValue,
      stock: String(product.stock ?? 0),
      lowStockThreshold: String(product.lowStockThreshold ?? 5),
      featured: !!product.featured,
    });
    setImages(imagesFromProduct(parseProductImages(product.images), product.imageMetadata));
    const loadedVariants = (product.variants ?? []).map(variantFromApi);
    setVariants(loadedVariants);
    setProductType(loadedVariants.length > 0 ? 'VARIANTS' : 'SIMPLE');
    setMeta({
      status: product.status,
      rejectionReason: product.rejectionReason ?? null,
      submittedAt: product.submittedAt ?? null,
      reviewedAt: product.reviewedAt ?? null,
      sku: product.sku ?? null,
      slug: product.slug ?? '',
      vendorId: product.vendorId ?? null,
    });
    setSlugTouched(true);
    resetBaselineRef.current = true;
  }, []);

  const loadProduct = useCallback(async () => {
    const { data } = await api.get(`/vendor/products/${id}`);
    applyProduct(data);
  }, [id, applyProduct]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [categoriesRes, brandsRes] = await Promise.all([api.get('/categories'), api.get('/brands')]);
        if (cancelled) return;
        setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
        setBrands(brandsRes.data?.brands ?? (Array.isArray(brandsRes.data) ? brandsRes.data : []));
        if (isAdmin) {
          const vendorsRes = await api.get('/vendors', { params: { limit: 1000, approved: true } });
          if (!cancelled) setVendors(vendorsRes.data?.vendors ?? (Array.isArray(vendorsRes.data) ? vendorsRes.data : []));
        }
        if (isEdit) await loadProduct();
        else resetBaselineRef.current = true;
      } catch (error) {
        if (!cancelled) setLoadError(getRequestErrorMessage(error, tr('productStudio.loadFailed', 'Failed to load the product')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, isEdit, loadProduct, tr]);

  // ─── Form helpers ───
  const patchForm = (patch: Partial<ProductFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    if ('slug' in patch) setSlugTouched(true);
  };
  const onNameChange = (name: string) => {
    setForm((prev) => ({ ...prev, name, ...(!slugTouched && !isEdit ? { slug: slugify(name) } : {}) }));
  };

  const status = meta?.status ?? null;
  const isLive = !!status && isProductVisibleOnStore(status);
  const variantRowsSaved = isEdit && variants.length > 0;
  const showVariantStudio = productType === 'VARIANTS';
  const showSimpleCommerce = productType === 'SIMPLE';
  const summaryData = getVariantSummary(variants);
  const variantBasePrice = summaryData.defaultVariant?.price || parseFloat(form.price) || null;

  // ─── Variant actions ───
  const refreshVariants = async () => {
    const { data } = await api.get(`/vendor/products/${id}/variants`);
    const next: StudioVariant[] = (data.variants ?? []).map(variantFromApi);
    setVariants(next);
    return next;
  };

  /** Deleting the last saved variant turns the product back into a simple product with stock 0. */
  const syncAfterLastVariant = async () => {
    const wasDirty = dirty;
    const { data } = await api.get(`/vendor/products/${id}`);
    const discount = getProductDiscountFormFields(data);
    setProductType('SIMPLE');
    setForm((prev) => ({
      ...prev,
      price: data.price != null ? String(data.price) : prev.price,
      discountType: (discount.discountType as ProductFormState['discountType']) || '',
      discountValue: discount.discountValue,
      stock: String(data.stock ?? 0),
    }));
    if (!wasDirty) resetBaselineRef.current = true;
  };

  const runVariantAction = async (variant: StudioVariant, request: () => Promise<any>, success: string) => {
    setVariantBusy(variant.clientKey);
    try {
      const response = await request();
      await refreshVariants();
      toast.success(success);
      return response;
    } catch (error) {
      toast.error(getRequestErrorMessage(error, tr('productStudio.variants.actionFailed', 'The variant could not be updated')));
      return null;
    } finally {
      setVariantBusy(null);
    }
  };

  const submitVariant = async (draft: VariantDraft): Promise<VariantSubmitResult | void> => {
    const editing = editor?.variant ?? null;
    const sku = draft.sku.trim().toLowerCase();
    if (sku && variants.some((v) => v.clientKey !== editing?.clientKey && v.sku.trim().toLowerCase() === sku)) {
      const message = tr('productStudio.variants.errors.skuDuplicate', 'Another variant of this product already uses this SKU.');
      return { fieldErrors: { sku: message }, message };
    }
    if (!isEdit) {
      const saved = studioVariantFromDraft(draft, editing ?? undefined);
      setVariants((prev) => withSingleDefault(
        editing ? prev.map((v) => (v.clientKey === editing.clientKey ? saved : v)) : [...prev, saved],
        saved.isDefault ? saved.clientKey : undefined,
      ));
      setVariantErrors({});
      setEditor(null);
      return undefined;
    }
    try {
      const body = variantPayload(draft);
      if (editing?.id) await api.patch(`/vendor/products/${id}/variants/${editing.id}`, body);
      else await api.post(`/vendor/products/${id}/variants`, body);
      await refreshVariants();
      setProductType('VARIANTS');
      toast.success(tr('productStudio.variants.saved', 'Variant saved'));
      setEditor(null);
      return undefined;
    } catch (error) {
      const mapped = mapServerErrors(error, tr('productStudio.variants.actionFailed', 'The variant could not be updated'));
      return { fieldErrors: mapped.fieldErrors, message: mapped.messages.join(' — ') };
    }
  };

  /** Create mode: adds to the local list. Edit mode: creates each variant through the existing endpoint, one by one. */
  const generateVariants = async (list: StudioVariant[]) => {
    if (!isEdit) {
      setVariants((prev) => mergeGenerated(prev, list));
      setProductType('VARIANTS');
      setGeneratorOpen(false);
      toast.success(tr('productStudio.generator.addedLocal', '{{count}} variants added to the list. They are created when you save the product.', { count: list.length }));
      return;
    }
    const failed: SummaryItem[] = [];
    setGenerationProgress({ done: 0, total: list.length });
    for (let index = 0; index < list.length; index += 1) {
      try {
        await api.post(`/vendor/products/${id}/variants`, variantPayload(list[index]));
      } catch (error) {
        failed.push({
          text: `${list[index].name}: ${getRequestErrorMessage(error, tr('productStudio.variants.actionFailed', 'The variant could not be updated'))}`,
          targetId: 'studio-variants',
        });
      }
      setGenerationProgress({ done: index + 1, total: list.length });
    }
    await refreshVariants().catch(() => undefined);
    setProductType('VARIANTS');
    setGenerationProgress(null);
    setGeneratorOpen(false);
    const created = list.length - failed.length;
    if (failed.length === 0) {
      toast.success(tr('productStudio.generator.created', '{{count}} variants created and saved.', { count: created }));
    } else {
      toast.error(tr('productStudio.generator.partial', '{{created}} variants created, {{failed}} failed.', { created, failed: failed.length }));
      setSummary(failed);
    }
  };

  const setDefaultVariant = (variant: StudioVariant) => {
    if (!variant.status || variant.isDefault) return;
    if (!isEdit) {
      setVariants((prev) => prev.map((v) => ({ ...v, isDefault: v.clientKey === variant.clientKey })));
      return;
    }
    runVariantAction(variant, () => api.patch(`/vendor/products/${id}/variants/${variant.id}`, { isDefault: true }),
      tr('productStudio.variants.defaultSaved', 'Default variant saved'));
  };

  const toggleVariantStatus = (variant: StudioVariant) => {
    if (!isEdit) {
      setVariants((prev) => withSingleDefault(prev.map((v) => (v.clientKey === variant.clientKey
        ? { ...v, status: !v.status, isDefault: v.status ? false : v.isDefault }
        : v))));
      return;
    }
    runVariantAction(variant, () => api.patch(`/vendor/products/${id}/variants/${variant.id}`, { status: !variant.status }),
      variant.status ? tr('productStudio.variants.deactivated', 'Variant deactivated') : tr('productStudio.variants.activated', 'Variant activated'));
  };

  const deleteVariant = async (variant: StudioVariant) => {
    setConfirm(null);
    if (!isEdit || !variant.id) {
      setVariants((prev) => withSingleDefault(prev.filter((v) => v.clientKey !== variant.clientKey)));
      return;
    }
    setVariantBusy(variant.clientKey);
    let response: any = null;
    try {
      response = await api.delete(`/vendor/products/${id}/variants/${variant.id}`);
      await refreshVariants();
    } catch (error) {
      toast.error(getRequestErrorMessage(error, tr('productStudio.variants.actionFailed', 'The variant could not be updated')));
    } finally {
      setVariantBusy(null);
    }
    if (!response) return;
    if (response.data?.deactivated) {
      toast(tr('productStudio.variants.deactivatedInstead', 'The variant was deactivated instead of deleted because it is linked to previous orders.'), { duration: 6000 });
    } else {
      toast.success(tr('productStudio.variants.deleted', 'Variant deleted.'));
    }
    const remaining = await api.get(`/vendor/products/${id}/variants`).then((r) => r.data.variants ?? []).catch(() => null);
    if (remaining && remaining.length === 0) {
      await syncAfterLastVariant();
      toast(tr('productStudio.variants.nowSimple', 'The last variant was removed, so this is a simple product again with stock 0.'), { duration: 6000 });
    }
  };

  const changeType = (type: ProductType) => {
    if (type === productType) return;
    if (type === 'SIMPLE' && !isEdit && variants.length > 0) {
      setConfirm({ kind: 'toSimple' });
      return;
    }
    setProductType(type);
  };

  // ─── Save ───
  const validate = (intent: Intent) => {
    const fieldErrors: FieldErrors = { ...validateBasics(form, tr) };
    const strict = intent !== 'draft' && !(intent === 'save' && !STRICT_SAVE_STATUSES.includes(status ?? ''));
    if (productType === 'SIMPLE') Object.assign(fieldErrors, validateSimpleCommerce(form, tr));
    if (productType === 'VARIANTS' && !isEdit) {
      if (variants.length === 0) {
        fieldErrors.variants = tr('productStudio.variants.errors.none', 'Add at least one variant, or choose Simple product.');
      } else if (strict && !variants.some((v) => v.status)) {
        fieldErrors.variants = tr('productStudio.variants.errors.noActive', 'At least one variant must be active.');
      }
      if (isAdmin && isPlatform) {
        fieldErrors.variants = tr('productStudio.admin.platformVariants', 'Platform products are created as simple products first. Add variants after the product is created.');
      }
    }
    if (isAdmin && !isEdit && !isPlatform && !vendorId) {
      fieldErrors.vendorId = tr('productStudio.admin.vendorRequired', 'Choose the vendor this product belongs to.');
    }
    const media = checkMedia(images, tr);
    const missingAlt = strict ? media.missingAltNew : [];
    if (media.error) fieldErrors.images = media.error;
    else if (missingAlt.length) {
      fieldErrors.images = tr('productStudio.media.altRequired', 'Add Arabic and English descriptions to the new images ({{count}}) before publishing or submitting.', { count: missingAlt.length });
    }
    return { fieldErrors, missingAlt };
  };

  const showErrors = (fieldErrors: FieldErrors, messages?: string[]) => {
    setErrors(fieldErrors);
    const items: SummaryItem[] = messages
      ? messages.map((text) => ({ text }))
      : Object.entries(fieldErrors).map(([field, text]) => ({ text, targetId: FIELD_TARGETS[field] }));
    if (messages) {
      Object.entries(fieldErrors).forEach(([field, text]) => {
        if (!messages.some((m) => m.endsWith(text))) items.push({ text, targetId: FIELD_TARGETS[field] });
      });
    }
    setSummary(items);
    requestAnimationFrame(() => document.getElementById('studio-validation-summary')?.focus());
  };

  const buildPayload = (intent: Intent) => {
    const payload: Record<string, unknown> = {
      categoryId: form.categoryId,
      brandId: form.brandId || null,
      name: form.name.trim(),
      nameAr: form.nameAr.trim(),
      slug: form.slug.trim() || undefined,
      description: form.description,
      descriptionAr: form.descriptionAr,
      ...buildImagePayload(images),
    };
    if (/^\d+$/.test(form.lowStockThreshold.trim())) payload.lowStockThreshold = parseInt(form.lowStockThreshold, 10);

    if (productType === 'SIMPLE') {
      Object.assign(payload, simplePricingPayload(form));
    } else if (!isEdit) {
      const normalized = withSingleDefault(variants);
      const def = getVariantSummary(normalized).defaultVariant ?? normalized[0];
      Object.assign(payload, {
        price: def.price,
        discountPrice: def.discountPrice,
        discountType: null,
        discountValue: null,
        stock: getVariantSummary(normalized).totalStock,
        hasVariants: true,
        variants: normalized.map(variantPayload),
      });
    }
    // Edit mode with variants: price, discount and stock are derived by the backend and not sent.

    if (canManageMarketplace) payload.featured = form.featured;
    if (isAdmin && !isEdit && !isPlatform) payload.vendorId = vendorId;

    const statusByIntent: Partial<Record<Intent, string>> = isEdit
      ? { hide: 'INACTIVE', show: isAdmin ? 'APPROVED' : 'ACTIVE' }
      : isAdmin ? { draft: 'DRAFT', publish: 'ACTIVE' } : { draft: 'DRAFT', submit: 'PENDING' };
    if (statusByIntent[intent]) payload.status = statusByIntent[intent];
    return payload;
  };

  const successMessage = (intent: Intent) => {
    switch (intent) {
      case 'draft': return tr('productStudio.toast.draftSaved', 'Draft saved');
      case 'submit': return tr('productStudio.toast.submitted', 'Saved and sent for review');
      case 'publish': return tr('productStudio.toast.published', 'Product saved and published');
      case 'approve': return tr('productStudio.toast.approved', 'Saved and approved');
      case 'hide': return tr('productStudio.toast.hidden', 'Saved and hidden from the store');
      case 'show': return isAdmin
        ? tr('productStudio.toast.shown', 'Saved and visible in the store')
        : tr('productStudio.toast.sentToReview', 'Saved. The product goes back to review before it is shown again.');
      default: return tr('productStudio.toast.saved', 'Changes saved');
    }
  };

  const runSave = async (intent: Intent) => {
    setConfirm(null);
    const { fieldErrors, missingAlt } = validate(intent);
    setBlockingAlt(missingAlt);
    setVariantErrors({});
    if (Object.keys(fieldErrors).length) {
      showErrors(fieldErrors);
      toast.error(tr('productStudio.errors.fixBeforeSaving', 'Fix the highlighted fields before saving.'));
      return;
    }
    setErrors({});
    setSummary([]);
    setSaving(true);
    try {
      const payload = buildPayload(intent);
      if (!isEdit) {
        const response = isAdmin && isPlatform
          ? await api.post('/admin/products/platform', payload)
          : await api.post('/vendor/products', payload);
        const createdId: string | undefined = response.data?.id ?? response.data?.product?.id;
        toast.success(successMessage(intent));
        setBaseline(snapshot);
        if (createdId) navigate(editPath(createdId), { replace: true });
        else navigate(listPath);
        return;
      }
      await api.patch(`/vendor/products/${id}`, payload);
      if (intent === 'submit' && !isAdmin) await api.post(`/vendor/products/${id}/submit`);
      if (intent === 'approve' && isAdmin) await api.post(`/admin/products/${id}/approve`);
      toast.success(successMessage(intent));
      await loadProduct();
    } catch (error) {
      const mapped = mapServerErrors(error, tr('productStudio.errors.saveFailed', 'The product could not be saved'));
      setVariantErrors(mapped.variantErrors);
      showErrors(mapped.fieldErrors, mapped.messages);
      toast.error(mapped.messages[0]);
      if (isEdit) {
        // A failed submit/approve after a successful PATCH still saved the product data.
        loadProduct().catch(() => undefined);
      }
    } finally {
      setSaving(false);
    }
  };

  const reject = async (reason: string) => {
    setSaving(true);
    try {
      await api.post(`/admin/products/${id}/reject`, { reason });
      toast.success(tr('productStudio.toast.rejected', 'Product rejected'));
      setRejecting(false);
      await loadProduct();
    } catch (error) {
      toast.error(getRequestErrorMessage(error, tr('productStudio.errors.saveFailed', 'The product could not be saved')));
    } finally {
      setSaving(false);
    }
  };

  // ─── Action dock ───
  const actions: DockAction[] = [];
  const add = (action: DockAction) => actions.push(action);
  // Saved-product preview reads the server copy; the side "Live preview" shows the unsaved form instead.
  if (!isAdmin && isEdit && !isLive) {
    add({ id: 'preview', label: tr('productStudio.actions.previewSaved', 'Preview saved product'), tone: 'secondary', onClick: () => leave(`/vendor/products/${id}/preview`) });
  }
  if (isAdmin) {
    if (!isEdit) {
      if (!isPlatform) add({ id: 'draft', label: tr('productStudio.actions.saveDraft', 'Save as draft'), tone: 'secondary', onClick: () => runSave('draft') });
      add({ id: 'publish', label: tr('productStudio.actions.publish', 'Publish'), tone: 'primary', onClick: () => runSave('publish') });
    } else {
      add({ id: 'preview', label: tr('productStudio.actions.preview', 'Preview'), tone: 'secondary', onClick: () => leave(`/admin/products/${id}/preview`) });
      if (status === 'INACTIVE' && canManageMarketplace) add({ id: 'show', label: tr('productStudio.actions.showInStore', 'Save & show in store'), tone: 'secondary', onClick: () => runSave('show') });
      if (isLive && canManageMarketplace) add({ id: 'hide', label: tr('productStudio.actions.hide', 'Save & hide from store'), tone: 'danger', onClick: () => setConfirm({ kind: 'hide' }) });
      if (status === 'PENDING' && canManageMarketplace) {
        add({ id: 'reject', label: tr('productStudio.actions.reject', 'Reject'), tone: 'danger', onClick: () => setRejecting(true), disabled: dirty });
        add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'secondary', onClick: () => runSave('save') });
        add({ id: 'approve', label: tr('productStudio.actions.saveApprove', 'Save & approve'), tone: 'primary', onClick: () => runSave('approve') });
      } else {
        add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'primary', onClick: () => runSave('save') });
      }
    }
  } else if (!isEdit) {
    add({ id: 'draft', label: tr('productStudio.actions.saveDraft', 'Save as draft'), tone: 'secondary', onClick: () => runSave('draft') });
    add({ id: 'submit', label: tr('productStudio.actions.submit', 'Submit for review'), tone: 'primary', onClick: () => runSave('submit') });
  } else if (status === 'DRAFT') {
    add({ id: 'save', label: tr('productStudio.actions.saveDraft', 'Save as draft'), tone: 'secondary', onClick: () => runSave('save') });
    add({ id: 'submit', label: tr('productStudio.actions.saveSubmit', 'Save & submit for review'), tone: 'primary', onClick: () => runSave('submit') });
  } else if (status === 'REJECTED') {
    add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'secondary', onClick: () => runSave('save') });
    add({ id: 'submit', label: tr('productStudio.actions.resubmit', 'Save & resubmit'), tone: 'primary', onClick: () => runSave('submit') });
  } else if (status === 'INACTIVE') {
    add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'secondary', onClick: () => runSave('save') });
    add({ id: 'show', label: tr('productStudio.actions.showAgain', 'Save & show again (goes to review)'), tone: 'primary', onClick: () => runSave('show') });
  } else if (isLive) {
    add({ id: 'view', label: tr('productStudio.actions.viewInStore', 'View in store'), tone: 'secondary', onClick: () => window.open(`/product/${meta?.slug}`, '_blank', 'noopener') });
    add({ id: 'hide', label: tr('productStudio.actions.hide', 'Save & hide from store'), tone: 'danger', onClick: () => setConfirm({ kind: 'hide' }) });
    add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'primary', onClick: () => runSave('save') });
  } else {
    add({ id: 'save', label: tr('productStudio.actions.saveChanges', 'Save changes'), tone: 'primary', onClick: () => runSave('save') });
  }

  const statusLine = !isEdit
    ? tr('productStudio.dock.new', 'New product — nothing is saved until you choose an action')
    : status === 'PENDING'
      ? tr('productStudio.dock.pending', 'Awaiting review — edits keep it in the review queue')
      : isLive
        ? tr('productStudio.dock.live', 'Live in the store — saved edits go live')
        : tr('productStudio.dock.saved', 'All product changes are saved');

  // ─── Preview data ───
  const mainImage = images.find((image) => image.status !== 'error' && (image.url || image.previewUrl)) ?? null;
  const previewVariant = productType === 'VARIANTS' ? summaryData.defaultVariant : null;
  const previewImageSrc = previewVariant?.image
    ? getImageUrl(previewVariant.image)
    : mainImage ? (mainImage.previewUrl ?? getImageUrl(mainImage.url)) : null;
  const previewAlt = previewVariant?.image
    ? getVariantImageAlt(previewVariant, { name: form.name, nameAr: form.nameAr }, isRTL)
    : mainImage
      ? ((isRTL ? mainImage.altAr || mainImage.altEn : mainImage.altEn || mainImage.altAr) || (isRTL ? form.nameAr || form.name : form.name || form.nameAr))
      : '';
  const categoryPath = findCategoryPath(categories, form.categoryId);
  const brand = brands.find((b) => b.id === form.brandId);
  const variantPreview = productType === 'VARIANTS' && variants.length > 0;
  const previewPrice = variantPreview ? summaryData.defaultVariant?.price ?? null : parseFloat(form.price) || null;
  const previewDiscount = variantPreview ? summaryData.defaultVariant?.discountPrice ?? null : getSimpleDiscountPrice(form);
  const previewStock = variantPreview ? summaryData.totalStock : parseInt(form.stock, 10) || 0;
  const vendorName = vendors.find((v) => v.id === (meta?.vendorId || vendorId))?.storeName ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-24" role="status" aria-label={tr('common.loading', 'Loading')}>
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8 text-center space-y-4">
        <p className="text-red-700 font-semibold" role="alert">{loadError}</p>
        <button type="button" className="btn-outline" onClick={() => navigate(listPath)}>{tr('productStudio.backToProducts', 'Back to products')}</button>
      </div>
    );
  }

  const typeLock = isEdit && variantRowsSaved
    ? { SIMPLE: tr('productStudio.type.lockedSimple', 'This product has saved variants. To sell it as a simple product, delete all its variants first (variants with orders can only be deactivated).') }
    : undefined;
  const typeNote = isEdit && productType === 'VARIANTS' && !variantRowsSaved
    ? tr('productStudio.type.convertNote', 'The product stays a simple product until you save its first variant. After that, its price and stock come from the variants.')
    : undefined;

  return (
    <div className="space-y-5 text-start">
      <ProductStudioHeader
        title={isEdit ? tr('productStudio.editTitle', 'Edit product') : tr('productStudio.createTitle', 'Add product')}
        subtitle={isEdit
          ? (isRTL ? form.nameAr || form.name : form.name || form.nameAr)
          : tr('productStudio.createSubtitle', 'Fill in the product details, images and pricing.')}
        backLabel={tr('productStudio.backToProducts', 'Back to products')}
        onBack={() => leave(listPath)}
        status={status}
        sku={meta?.sku}
        vendorName={isAdmin ? vendorName : null}
      />

      {isEdit && status && (
        isAdmin ? (
          <div className={`rounded-2xl border p-4 text-sm ${status === 'REJECTED' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-100 text-gray-700'}`}>
            <p>{tr(`productStudio.adminHint.${status}`, {
              DRAFT: 'Draft: the vendor has not submitted it. Publishing requires the vendor to submit it for review.',
              PENDING: 'Waiting for review. Save your fixes, then approve or reject.',
              REJECTED: 'Rejected. The vendor must fix and resubmit it.',
              INACTIVE: 'Hidden from the store.',
              ACTIVE: 'Live in the store.',
              APPROVED: 'Live in the store.',
            }[status] ?? status)}</p>
            {status === 'REJECTED' && meta?.rejectionReason && (
              <p className="mt-1 whitespace-pre-line"><span className="font-semibold">{tr('moderation.rejectionReason', 'Rejection reason')}:</span> {meta.rejectionReason}</p>
            )}
          </div>
        ) : (
          <ProductReviewStatus status={status} rejectionReason={meta?.rejectionReason} submittedAt={meta?.submittedAt} reviewedAt={meta?.reviewedAt} />
        )
      )}
      {!isEdit && !isAdmin && (
        <p className="text-sm text-gray-600 bg-gray-50 border border-gray-100 rounded-2xl p-3">
          {tr('moderation.createHint', 'Save as a draft to keep editing, or submit it for review. The product appears in the store once GoKnary approves it.')}
        </p>
      )}

      <ProductValidationSummary title={tr('productStudio.errors.summaryTitle', 'The product could not be saved')} items={summary} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-5">
          <ProductTypeSelector value={productType} onChange={changeType} lockedReason={typeLock} note={typeNote} />
          <ProductBasicInfoSection
            form={form}
            errors={errors}
            onChange={patchForm}
            onNameChange={onNameChange}
            onSlugBlur={() => setForm((prev) => ({ ...prev, slug: slugify(prev.slug) }))}
          />
          <ProductOrganizationSection form={form} errors={errors} categories={categories} brands={brands} onChange={patchForm} />
          <ProductMediaStudio images={images} setImages={setImages} error={errors.images} highlightMissingAlt={blockingAlt} />
          {showSimpleCommerce && (
            <>
              <SimpleProductPricing form={form} errors={errors} onChange={patchForm} />
              <SimpleProductInventory form={form} errors={errors} onChange={patchForm} />
            </>
          )}
          {showVariantStudio && (
            <VariantStudio
              variants={variants}
              persistence={isEdit ? 'immediate' : 'local'}
              busyKey={variantBusy}
              productName={{ name: form.name, nameAr: form.nameAr }}
              error={errors.variants}
              variantErrors={variantErrors}
              onAdd={() => setEditor({ variant: null })}
              onGenerate={() => setGeneratorOpen(true)}
              onEdit={(variant) => setEditor({ variant })}
              onSetDefault={setDefaultVariant}
              onToggleStatus={toggleVariantStatus}
              onDelete={(variant) => {
                if (isEdit && !canDeleteVariants) {
                  toast.error(tr('productStudio.variants.noDeletePermission', 'You do not have permission to delete variants.'));
                  return;
                }
                setConfirm({ kind: 'deleteVariant', variant });
              }}
            />
          )}
        </div>

        <aside className="lg:col-span-4 space-y-5 lg:sticky lg:top-24">
          {isAdmin && (
            <section aria-labelledby="studio-admin-title" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h2 id="studio-admin-title" className="text-sm font-bold text-gray-900">{tr('productStudio.admin.title', 'Marketplace settings')}</h2>
              {!isEdit ? (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={isPlatform} onChange={(e) => setIsPlatform(e.target.checked)} className="mt-0.5 w-4 h-4 accent-primary-600" />
                    <span>
                      <span className="font-semibold text-gray-800">{tr('productStudio.admin.platform', 'GoKnary official product')}</span>
                      <span className="block text-xs text-gray-500">{tr('productStudio.admin.platformHelp', 'Created under the GoKnary Official store and published directly.')}</span>
                    </span>
                  </label>
                  {!isPlatform && (
                    <div>
                      <label htmlFor="studio-vendor" className="block text-sm font-semibold text-gray-800 mb-1">
                        {tr('productStudio.admin.vendor', 'Vendor')}<span className="text-red-500 ms-0.5" aria-hidden="true">*</span>
                      </label>
                      <select
                        id="studio-vendor"
                        value={vendorId}
                        onChange={(e) => setVendorId(e.target.value)}
                        className={`input-field w-full ${errors.vendorId ? 'border-red-400' : ''}`}
                        aria-invalid={!!errors.vendorId}
                        aria-describedby={errors.vendorId ? 'studio-vendor-error' : undefined}
                      >
                        <option value="">{tr('admin.selectVendor', 'Select a vendor...')}</option>
                        {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.storeName}</option>)}
                      </select>
                      {errors.vendorId && <p id="studio-vendor-error" className="text-xs text-red-600 mt-1">{errors.vendorId}</p>}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-700">{tr('productStudio.admin.vendor', 'Vendor')}: <span className="font-semibold">{vendorName ?? '—'}</span></p>
              )}
              {canManageMarketplace && !(isPlatform && !isEdit) && (
                <label className="flex items-start gap-2 text-sm">
                  <input type="checkbox" checked={form.featured} onChange={(e) => patchForm({ featured: e.target.checked })} className="mt-0.5 w-4 h-4 accent-primary-600" />
                  <span>
                    <span className="font-semibold text-gray-800">{tr('productStudio.admin.featured', 'Featured')}</span>
                    <span className="block text-xs text-gray-500">{tr('productStudio.admin.featuredHelp', 'Marks the product as featured in marketplace placements.')}</span>
                  </span>
                </label>
              )}
            </section>
          )}
          <ProductLivePreview
            name={form.name}
            nameAr={form.nameAr}
            imageSrc={previewImageSrc}
            imageAlt={previewAlt}
            brandName={brand ? (isRTL && brand.nameAr ? brand.nameAr : brand.name) : null}
            categoryName={categoryPath.length ? getCategoryLabel(categoryPath[categoryPath.length - 1], isRTL) : null}
            vendorName={isAdmin ? vendorName : null}
            price={previewPrice}
            discountPrice={previewDiscount}
            stock={previewStock}
            isVariantProduct={productType === 'VARIANTS'}
            defaultVariant={summaryData.defaultVariant}
          />
        </aside>
      </div>

      <ProductActionDock
        statusLine={statusLine}
        detailLine={productType === 'VARIANTS' && variants.length > 0
          ? tr('productStudio.dock.variantDetail', '{{count}} variants · total stock {{stock}}', { count: variants.length, stock: summaryData.totalStock })
          : undefined}
        dirty={dirty}
        busy={saving}
        actions={actions}
      />

      <VariantEditorDialog
        open={!!editor}
        variant={editor?.variant ?? null}
        isFirst={variants.length === 0}
        persistence={isEdit ? 'immediate' : 'local'}
        existingVariants={variants}
        basePrice={variantBasePrice}
        onClose={() => setEditor(null)}
        onSubmit={submitVariant}
      />
      <VariantGeneratorDialog
        open={generatorOpen}
        persistence={isEdit ? 'immediate' : 'local'}
        existingVariants={variants}
        basePrice={variantBasePrice}
        progress={generationProgress}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={generateVariants}
      />

      <ConfirmDialog
        open={confirm?.kind === 'deleteVariant'}
        title={tr('productStudio.variants.deleteTitle', 'Delete variant?')}
        message={confirm?.kind === 'deleteVariant'
          ? [
            isEdit
              ? tr('productStudio.variants.deleteMessage', 'If this variant has been used in orders, it is deactivated instead of deleted to keep the order history.')
              : tr('productStudio.variants.deleteLocal', 'The variant is removed from the list.'),
            isEdit && variants.length === 1
              ? tr('productStudio.variants.deleteLast', 'This is the last variant: if it is deleted, the product becomes a simple product with stock 0.')
              : '',
          ].filter(Boolean).join('\n\n')
          : ''}
        confirmLabel={tr('common.delete', 'Delete')}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.kind === 'deleteVariant' && deleteVariant(confirm.variant)}
      />
      <ConfirmDialog
        open={confirm?.kind === 'toSimple'}
        title={tr('productStudio.type.toSimpleTitle', 'Switch to a simple product?')}
        message={tr('productStudio.type.toSimpleMessage', 'The {{count}} variants you added (not saved yet) will be removed from this form.', { count: variants.length })}
        confirmLabel={tr('productStudio.type.toSimpleConfirm', 'Remove variants and switch')}
        tone="danger"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setVariants([]);
          setProductType('SIMPLE');
          setConfirm(null);
        }}
      />
      <ConfirmDialog
        open={confirm?.kind === 'hide'}
        title={tr('productStudio.hideTitle', 'Hide this product?')}
        message={tr('productStudio.hideMessage', 'Your changes are saved and the product is removed from the store until it is shown again.')}
        confirmLabel={tr('productStudio.actions.hide', 'Save & hide from store')}
        tone="danger"
        busy={saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => runSave('hide')}
      />
      {isAdmin && (
        <RejectProductModal
          productName={rejecting ? (form.name || form.nameAr) : null}
          submitting={saving}
          onCancel={() => setRejecting(false)}
          onConfirm={reject}
        />
      )}
      {unsavedDialog}
    </div>
  );
};

export default ProductStudio;
