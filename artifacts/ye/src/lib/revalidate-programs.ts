import { revalidatePath } from 'next/cache';

/** Covers both locale detail caches, including previous/next sibling links. */
export function revalidatePrograms() {
  revalidatePath('/programs/[slug]', 'page');
  revalidatePath('/en/programs/[slug]', 'page');
  for (const path of ['/programs', '/en/programs', '/book', '/en/book', '/enroll', '/en/enroll']) {
    revalidatePath(path);
  }
}
