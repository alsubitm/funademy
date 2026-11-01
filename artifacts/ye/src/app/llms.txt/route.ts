import { prisma } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';
import { CATALOG, FIELDS } from '@/lib/catalog';

// Request-time rendering with the production env + database — the publish
// build runs in the workspace env, which would bake dev-database content
// into the deployed file (same reasoning as sitemap.ts).
export const dynamic = 'force-dynamic';

/** Fallback only — the live list comes from the Program table. */
const FALLBACK_PROGRAM_SLUGS = [
  'big-builders',
  'smartivo',
  'bricks-challenge',
  'algoplay-robotoys',
  'galileo-technic',
  'algoc',
];

export async function GET() {
  const base = siteUrl();

  const programs = await prisma.program
    .findMany({
      select: {
        slug: true,
        nameEn: true,
        nameAr: true,
        ageMin: true,
        ageMax: true,
        taglineEn: true,
      },
      orderBy: { position: 'asc' },
    })
    .catch(
      () =>
        [] as {
          slug: string;
          nameEn: string;
          nameAr: string;
          ageMin: number;
          ageMax: number;
          taglineEn: string;
        }[],
    );

  const posts = await prisma.blogPost
    .findMany({
      where: { published: true },
      select: { slug: true, titleAr: true, titleEn: true },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    })
    .catch(() => [] as { slug: string; titleAr: string; titleEn: string | null }[]);

  const programLines = programs.length
    ? programs.map((p) => {
        const spec = CATALOG[p.slug];
        const details = [
          `ages ${p.ageMin}-${p.ageMax}`,
          spec ? `${spec.lessonMin}-minute in-person classes in Riyadh` : 'in-person classes in Riyadh',
          spec ? FIELDS[spec.field].en : null,
        ]
          .filter(Boolean)
          .join(', ');
        return `- [${p.nameEn} (${p.nameAr})](${base}/programs/${p.slug}): ${p.taglineEn} — ${details}`;
      })
    : FALLBACK_PROGRAM_SLUGS.map((s) => `- [${s}](${base}/programs/${s})`);

  const blogLines = posts.map(
    (p) => `- [${p.titleAr}${p.titleEn ? ` / ${p.titleEn}` : ''}](${base}/blog/${p.slug})`,
  );

  const ageRange = programs.length
    ? `ages ${Math.min(...programs.map((p) => p.ageMin))}-${Math.max(...programs.map((p) => p.ageMax))}`
    : 'children and teens';

  const md = `# FunAdemy — e² Young Engineers Riyadh (فناديمي)

> FunAdemy is the official e² Young Engineers franchise in Riyadh, Saudi Arabia: LEGO®-based STEM enrichment for kids (${ageRange}) — in-person engineering, coding and robotics classes taught in Arabic, with program enrollment, trial booking and parent consultations handled on this site.

Key facts:
- Arabic is the site's primary language (right-to-left). Every public page has an English mirror under /en (for example ${base}/en/programs/...).
- Programs are in-person classes in Riyadh in three fields: The World Around Us (العالم من حولنا), Mechanical Engineering (الهندسة الميكانيكية), and Coding & Robotics (البرمجة والروبوتات).
- Prices are in Saudi Riyal (SAR); enrollment and payment happen online at ${base}/enroll.
- The parent portal, kids' learning area and admin dashboard require login and are private — they are excluded from crawling in robots.txt.

## Programs (البرامج)

${programLines.join('\n')}

## Enrollment & booking (التسجيل والحجز)

- [Enroll (سجّل الآن)](${base}/enroll): choose a program and course run, then pay online
- [Book a trial class (احجز حصة تجريبية)](${base}/book)
- [Parent consultation (استشارة تعليمية)](${base}/consult): book a one-on-one video consultation
- [Contact (تواصل معنا)](${base}/contact)

## Content (المحتوى)

- [Blog (المدونة)](${base}/blog)
${blogLines.length ? blogLines.join('\n') : ''}

## Campaigns (الحملات)

- [Watanona (وطنّا)](${base}/watanona): campaign landing page

## Policies & compliance (السياسات)

- [Privacy policy (سياسة الخصوصية)](${base}/privacy)
- [Terms of service (الشروط والأحكام)](${base}/terms)
- [NELC licensing (ترخيص المركز الوطني للتعليم الإلكتروني)](${base}/nelc)

## Notes for AI agents

- Canonical origin: ${base} — use it for all links to this site.
- English mirrors: prepend /en to any path above.
- Machine-readable page list: ${base}/sitemap.xml
`;

  return new Response(md, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
