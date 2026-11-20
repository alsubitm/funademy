'use client';

import { type AdminPagination, setAdminParams } from './useAdminQuery';

export function AdminPaging({ page, prefix, busy, refresh }: { page: AdminPagination; prefix: 'b' | 'r'; busy: boolean; refresh: () => void }) {
  const navigate = (cursor: string | null) => setAdminParams({ [`${prefix}cursor`]: cursor }, 'push');
  return (
    <nav className="flex flex-wrap items-center gap-3" aria-label="صفحات النتائج">
      <button className="adm-btn line" disabled={busy || !page.previousCursor} onClick={() => navigate(page.previousCursor)}>السابق</button>
      <button className="adm-btn line" disabled={busy || !page.nextCursor} onClick={() => navigate(page.nextCursor)}>التالي</button>
      <button className="adm-btn line" disabled={busy} onClick={() => {
        if (new URLSearchParams(window.location.search).has(`${prefix}cursor`)) navigate(null);
        else refresh();
      }}>أحدث السجلات</button>
      <span className="adm-hint">الأحدث إضافة أولاً · الأعداد مباشرة وقد تتغير أثناء التصفح</span>
    </nav>
  );
}
