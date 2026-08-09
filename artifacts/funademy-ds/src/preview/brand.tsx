import logoUrl from '../assets/ye-logo.svg';

export function BrandLogoPage() {
  return (
    <div className="space-y-8" dir="rtl">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">الشعار</h2>
        <p className="mt-2 text-muted-foreground">
          شعار برنامج e² Young Engineers المعتمد لدى FunAdemy. يُستخدم كما هو دون
          تغيير الألوان أو التشويه، مع مساحة فارغة كافية حوله.
        </p>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex items-center justify-center rounded-xl border border-border bg-card p-10">
          <img src={logoUrl} alt="e² Young Engineers" className="h-40 w-40" />
        </div>
        <div className="flex items-center justify-center rounded-xl bg-sidebar p-10">
          <img src={logoUrl} alt="e² Young Engineers" className="h-40 w-40" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        اسم «FunAdemy» يُكتب نصياً بخط العناوين (Baloo Bhaijaan 2) بالأزرق الكحلي
        مع نجمة ذهبية — لا يوجد شعار رسومي منفصل للاسم حالياً.
      </p>
    </div>
  );
}
