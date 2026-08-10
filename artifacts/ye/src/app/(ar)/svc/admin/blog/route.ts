import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS = ['titleAr', 'titleEn', 'excerptAr', 'excerptEn', 'contentAr', 'contentEn', 'coverEmoji', 'published'] as const;

function revalidateBlog(slug?: string) {
  revalidatePath('/blog');
  revalidatePath('/en/blog');
  if (slug) {
    revalidatePath(`/blog/${slug}`);
    revalidatePath(`/en/blog/${slug}`);
  }
}

/** Admin blog CMS: list, create, update, delete posts. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const posts = await prisma.blogPost.findMany({ orderBy: { publishedAt: 'desc' } });
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const slug = String(b?.slug ?? '').trim();
  const titleAr = String(b?.titleAr ?? '').trim();
  const excerptAr = String(b?.excerptAr ?? '').trim();
  const contentAr = String(b?.contentAr ?? '').trim();
  if (!SLUG_RE.test(slug) || !titleAr || !excerptAr || !contentAr) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const exists = await prisma.blogPost.findUnique({ where: { slug } });
  if (exists) return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
  const post = await prisma.blogPost.create({
    data: {
      slug,
      titleAr,
      excerptAr,
      contentAr,
      titleEn: b?.titleEn ? String(b.titleEn).trim() : null,
      excerptEn: b?.excerptEn ? String(b.excerptEn).trim() : null,
      contentEn: b?.contentEn ? String(b.contentEn).trim() : null,
      coverEmoji: b?.coverEmoji ? String(b.coverEmoji).trim() : '📚',
      published: b?.published !== false,
    },
  });
  revalidateBlog(post.slug);
  return NextResponse.json({ post }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(b?.data ?? {})) {
    if (!(FIELDS as readonly string[]).includes(k)) continue;
    if (k === 'published') data[k] = Boolean(v);
    else if (['titleEn', 'excerptEn', 'contentEn'].includes(k)) data[k] = v ? String(v) : null;
    else data[k] = String(v ?? '');
  }
  // Required Arabic fields must not be blanked out.
  for (const k of ['titleAr', 'excerptAr', 'contentAr', 'coverEmoji']) {
    if (k in data && !String(data[k]).trim()) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
  }
  const post = await prisma.blogPost.update({ where: { id }, data });
  revalidateBlog(post.slug);
  return NextResponse.json({ post });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  await prisma.blogPost.delete({ where: { id } });
  revalidateBlog(existing.slug);
  return NextResponse.json({ ok: true });
}
