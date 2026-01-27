# كيفية نسخ الصور

## النسخ التلقائي
تم نسخ الصور من `/imgs` إلى `/frontend/public/imgs/`

## النسخ اليدوي (إذا لزم الأمر)

```powershell
# إنشاء المجلد
New-Item -ItemType Directory -Path "frontend\public\imgs" -Force

# نسخ الصور
Copy-Item -Path "imgs\*.jpg" -Destination "frontend\public\imgs\" -Force
```

## التحقق
يجب أن تكون الصور موجودة في:
- `frontend/public/imgs/` - 32 صورة JPG

## ملاحظات
- المسارات في الكود: `/imgs/filename.jpg`
- React يخدم الملفات من `public/` مباشرة
- بعد نسخ الصور، أعد تشغيل `npm start` في frontend

