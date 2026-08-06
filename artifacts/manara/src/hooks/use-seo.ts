import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';

export function useSeo(titleAr: string, descriptionAr: string, titleEn?: string, descriptionEn?: string) {
  const { lang } = useI18n();

  useEffect(() => {
    const title = lang === 'ar' ? titleAr : (titleEn || titleAr);
    const description = lang === 'ar' ? descriptionAr : (descriptionEn || descriptionAr);

    // Update title
    document.title = `${title} | Manara Academy`;

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', description);

    // Open Graph
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) {
      ogTitle = document.createElement('meta');
      ogTitle.setAttribute('property', 'og:title');
      document.head.appendChild(ogTitle);
    }
    ogTitle.setAttribute('content', `${title} | Manara Academy`);

    let ogDescription = document.querySelector('meta[property="og:description"]');
    if (!ogDescription) {
      ogDescription = document.createElement('meta');
      ogDescription.setAttribute('property', 'og:description');
      document.head.appendChild(ogDescription);
    }
    ogDescription.setAttribute('content', description);

  }, [titleAr, descriptionAr, titleEn, descriptionEn, lang]);
}
