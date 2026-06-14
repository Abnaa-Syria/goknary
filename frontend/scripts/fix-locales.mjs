import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const localesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/i18n/locales');

export function patchVendorLocales(vendor, lang) {
  const isAr = lang === 'ar';

  vendor.dashboard = {
    title: isAr ? 'لوحة تحكم البائع' : 'Vendor Dashboard',
    reviewTitle:
      vendor.dashboard?.reviewTitle ??
      (isAr ? 'طلب الانضمام قيد المراجعة' : 'Application Under Review'),
    reviewMessage:
      vendor.dashboard?.reviewMessage ??
      (isAr
        ? 'طلب انضمامك كبائع قيد المراجعة من قبل فريقنا. ستتلقى رسالة بريد إلكتروني بمجرد الموافقة. تستغرق هذه العملية عادةً من يوم إلى يومي عمل.'
        : "Your vendor application is being reviewed by our team. You'll receive an email once it's approved. This process typically takes 1-2 business days."),
    failedAnalytics: isAr ? 'فشل تحميل تحليلات المتجر' : 'Failed to load store analytics',
  };

  vendor.applyPage = {
    title: isAr ? 'كن بائعاً' : 'Become a Vendor',
    description: isAr
      ? 'قدّم طلب الانضمام كبائع وابدأ ببيع منتجاتك على جو كناري. املأ النموذج أدناه وسنراجع طلبك.'
      : "Apply to become a vendor and start selling your products on GoKnary. Fill out the form below and we'll review your application.",
    loginRequired: isAr
      ? 'يجب أن يكون لديك حساب وأن تكون مسجلاً الدخول للتقديم كبائع. سجّل الدخول أو أنشئ حساباً أولاً.'
      : 'You need to have an account and be logged in to apply as a vendor. Please log in or create an account first.',
    alreadyVendor: isAr ? 'أنت بائع بالفعل!' : 'You are already a vendor!',
    goToDashboard: isAr ? 'انتقل إلى لوحة تحكم البائع لإدارة متجرك.' : 'Head to your vendor dashboard to manage your store.',
    submittedTitle: isAr ? 'تم تقديم الطلب!' : 'Application Submitted!',
    submittedMessage: isAr
      ? 'تم تقديم طلب الانضمام كبائع بنجاح. سنراجعه ونبلغك فور الموافقة.'
      : "Your vendor application has been submitted successfully. We'll review it and notify you once it's approved.",
    storeNameHelp: isAr ? 'سيكون هذا الاسم العام لمتجرك' : "This will be your store's public name",
    submit: isAr ? 'تقديم الطلب' : 'Submit Application',
    failedSubmit: isAr ? 'فشل تقديم الطلب' : 'Failed to submit application',
  };

  vendor.analyticsPage = {
    lastYear: isAr ? 'آخر سنة' : 'Last year',
  };

  vendor.productSlug = isAr ? 'رابط المنتج / المسار' : 'Product Slug / URL Path';

  Object.assign(vendor.productForm, {
    productNamePlaceholder: isAr ? 'اسم المنتج بالإنجليزية' : 'Product name in English',
    productNameArPlaceholder: isAr ? 'اسم المنتج بالعربية' : 'اسم المنتج بالعربية',
    slugPlaceholder: isAr ? 'مثال: product-slug' : 'e.g. my-product-slug',
    slugHelp: isAr
      ? 'يُستخدم في مسار الرابط (يدعم العربية والإنجليزية).'
      : 'Used in URL path (supports Arabic and English).',
    productDescPlaceholder: isAr ? 'وصف المنتج بالإنجليزية' : 'Product description in English',
    productDescArPlaceholder: isAr ? 'وصف المنتج بالعربية' : 'وصف المنتج بالعربية',
    discountPrice: isAr ? 'سعر الخصم' : 'Discount Price',
    stock: isAr ? 'المخزون' : 'Stock',
    variantNameArPlaceholder: isAr ? 'مثال: أحمر - كبير' : 'مثال: أحمر - كبير',
    attributeNameArPlaceholder: isAr ? 'مثال: اللون' : 'مثال: اللون',
    valueArPlaceholder: isAr ? 'مثال: أحمر' : 'مثال: أحمر',
    updateVariant: isAr ? 'تحديث الخيار' : 'Update Variant',
    updating: isAr ? 'جاري الإرسال...' : 'Submitting...',
  });

  // Code uses failedSync* while locales had failedToSync*
  vendor.failedSyncTickets = vendor.failedToSyncTickets;
  vendor.failedSyncRefunds = vendor.failedToSyncRefunds;
  vendor.failedUpdateRefund = vendor.failedToUpdateRefund;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  function loadJson(file) {
    return JSON.parse(fs.readFileSync(path.join(localesDir, file), 'utf8'));
  }

  function saveJson(file, data) {
    fs.writeFileSync(path.join(localesDir, file), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  }

  function flatten(obj, prefix = '', out = {}) {
    if (obj !== null && typeof obj === 'object' && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) {
        flatten(v, prefix ? `${prefix}.${k}` : k, out);
      }
    } else out[prefix] = obj;
    return out;
  }

  function rebuild(template, flat, prefix = '') {
    if (template !== null && typeof template === 'object' && !Array.isArray(template)) {
      const o = {};
      for (const k of Object.keys(template)) {
        const p = prefix ? `${prefix}.${k}` : k;
        o[k] = rebuild(template[k], flat, p);
      }
      return o;
    }
    return flat[prefix];
  }

  const ar = loadJson('ar.json');
  const en = loadJson('en.json');

  patchVendorLocales(ar.vendor, 'ar');
  patchVendorLocales(en.vendor, 'en');

  const enFlat = flatten(en);
  const syncedEn = rebuild(ar, enFlat);

  saveJson('ar.json', ar);
  saveJson('en.json', syncedEn);

  const arFlat = flatten(ar);
  const outFlat = flatten(syncedEn);
  const missing = Object.keys(arFlat).filter((k) => outFlat[k] === undefined);
  console.log('AR keys:', Object.keys(arFlat).length);
  console.log('EN keys:', Object.keys(outFlat).length);
  console.log('Structure aligned:', missing.length === 0);
  if (missing.length) console.log('Still missing:', missing.join(', '));
}
