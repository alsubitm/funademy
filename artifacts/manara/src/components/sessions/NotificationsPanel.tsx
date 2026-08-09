import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useListMySessionNotifications } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell } from 'lucide-react';
import { formatDateTime, type SessionNotification } from './types';

export function NotificationsPanel() {
  const { t, lang } = useI18n();
  const { data, isLoading } = useListMySessionNotifications();
  const notifications = (data as SessionNotification[] | undefined) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4 text-primary" />
          {t('إشعارات الجلسات', 'Session notifications')}
          {notifications.length > 0 && (
            <span className="ms-auto text-xs bg-primary/10 text-primary rounded-full px-2 py-0.5">
              {notifications.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {t('لا توجد إشعارات بعد.', 'No notifications yet.')}
          </p>
        ) : (
          <ul className="space-y-3 max-h-72 overflow-y-auto">
            {notifications.map((n) => (
              <li key={n.id} className="text-sm border-b last:border-b-0 pb-2 last:pb-0">
                <p className="text-foreground">{n.message}</p>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
