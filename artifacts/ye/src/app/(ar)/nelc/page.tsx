import { LegalShell } from '@/components/legal/LegalShell';
import { EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER, NELC_LICENSE_NO } from '@/lib/constants';
import { siteUrl } from '@/lib/site-url';

// Dynamically rendered so the env var NELC_LICENSE_NO is not statically baked
// in at build time. In practice, license number changes require a new
// deployment (which Replit triggers automatically when a secret is added or
// updated) — no code change is needed.
export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'الجاهزية للمركز الوطني للتعليم الإلكتروني | FunAdemy',
  description:
    'جاهزية منصة FunAdemy للترخيص والتكامل مع المركز الوطني للتعليم الإلكتروني (NELC) والمنصة الوطنية FutureX.',
  alternates: {
    canonical: `${siteUrl()}/nelc`,
    languages: {
      'ar-SA': `${siteUrl()}/nelc`,
      'en': `${siteUrl()}/en/nelc`,
      'x-default': `${siteUrl()}/nelc`,
    },
  },
};

export default function NelcPage() {
  return (
    <LegalShell
      lang="ar"
      kick="NELC READINESS"
      title="الجاهزية للمركز الوطني للتعليم الإلكتروني"
      intro="نعمل على استيفاء متطلبات ترخيص التدريب الإلكتروني والتكامل مع المنصة الوطنية، وهذه الصفحة توضح حالتنا بشفافية."
      updated="آخر تحديث: أغسطس 2026"
    >
      <h2>ما هو المركز الوطني للتعليم الإلكتروني؟</h2>
      <p>
        المركز الوطني للتعليم الإلكتروني (NELC) هو الجهة المنظمة للتعليم والتدريب الإلكتروني في المملكة
        العربية السعودية. يصدر المركز — بالتكامل مع المؤسسة العامة للتدريب التقني والمهني — ترخيصاً
        موحداً لمنصات التدريب الإلكتروني، ويتيح للمنصات المرخصة التكامل التقني مع المنصة الوطنية
        للتعليم الإلكتروني (FutureX) لعرض برامجها والوصول لمتدربين على مستوى المملكة.
      </p>

      <h2>حالة الترخيص</h2>
      <div className="card-note">
        {NELC_LICENSE_NO ? (
          <>
            <strong>مرخصة ✅</strong> — رقم ترخيص المركز الوطني للتعليم الإلكتروني: <span dir="ltr">{NELC_LICENSE_NO}</span>
          </>
        ) : (
          <>
            <strong>قيد الإعداد 🟡</strong> — استوفينا المتطلبات الأساسية أدناه ونجهّز طلب الترخيص الموحد.
            سيُعرض رقم الترخيص في هذه الصفحة وفي أسفل الموقع فور صدوره.
          </>
        )}
      </div>

      <h2>ما استوفيناه من متطلبات الجاهزية</h2>
      <ul className="nelc-check">
        <li>هوية تجارية سعودية واضحة وسجل تجاري معلن في الموقع.</li>
        <li>سياسة خصوصية منشورة تتوافق مع نظام حماية البيانات الشخصية، مع حماية خاصة لبيانات الأطفال.</li>
        <li>شروط وأحكام معلنة تشمل سياسة الدفع والاسترداد وآلية الدعم والشكاوى.</li>
        <li>دفع إلكتروني عبر مزودين مرخصين في المملكة (ميسر وتمارا) دون تخزين بيانات البطاقات.</li>
        <li>دخول آمن برمز تحقق لمرة واحدة (OTP) وجلسات مشفرة عبر HTTPS.</li>
        <li>محتوى تعليمي عربي أصيل بمنهجية عالمية (شراكة e² Young Engineers).</li>
        <li>تتبع تقدم المتعلم: سجل حضور، دروس مكتملة، نقاط وأوسمة، وتقارير للأهالي.</li>
        <li>شهادات إتمام للبرامج وقنوات دعم فني معلنة بأوقات استجابة محددة.</li>
      </ul>

      <h2>خطواتنا القادمة نحو الربط</h2>
      <ol className="nelc-steps">
        <li>التقديم على الترخيص الموحد لمنصات التدريب الإلكتروني عبر بوابة المركز الوطني.</li>
        <li>استكمال أي اشتراطات فنية أو إدارية يطلبها فريق الترخيص.</li>
        <li>بعد صدور الترخيص: التقدم لخدمة التكامل التقني مع المنصة الوطنية FutureX لعرض برامجنا فيها.</li>
        <li>تفعيل تبادل بيانات البرامج والتسجيل والشهادات وفق المعايير الوطنية للتعليم الإلكتروني.</li>
      </ol>

      <h2>للجهات والشركاء</h2>
      <p>
        إذا كنت من فريق المركز الوطني أو جهة شريكة وترغب بالتواصل الرسمي بخصوص الترخيص أو التكامل:
        البريد <a href={`mailto:${EMAIL}`}>{EMAIL}</a> أو واتساب{' '}
        <a href={`https://wa.me/${WHATSAPP_NUMBER}`} dir="ltr">{PHONE_DISPLAY}</a>.
      </p>
    </LegalShell>
  );
}
