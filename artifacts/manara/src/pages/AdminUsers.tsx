import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useListAdminUsers, useUpdateAdminUser, getListAdminUsersQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MoreVertical, CalendarPlus, ShieldAlert } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

// Note: Ensure `useDebounce` hook exists or use a simple timeout approach.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export default function AdminUsers() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 500);

  const { data: users, isLoading } = useListAdminUsers({ search: debouncedSearch || undefined }, { 
    query: { queryKey: getListAdminUsersQueryKey({ search: debouncedSearch || undefined }) }
  });

  const updateMutation = useUpdateAdminUser();

  const handleExtendTrial = (id: number) => {
    if (confirm('Extend trial by 7 days for this user?')) {
      updateMutation.mutate({ id, data: { extendTrialDays: 7 } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({ search: debouncedSearch || undefined }) });
          toast({ title: 'Trial Extended', description: 'Added 7 days to trial period.' });
        }
      });
    }
  };

  const handleCancelSub = (id: number) => {
    if (confirm('Cancel this user\'s subscription?')) {
      updateMutation.mutate({ id, data: { subscriptionStatus: 'cancelled' } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey({ search: debouncedSearch || undefined }) });
          toast({ title: 'Subscription Cancelled' });
        }
      });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto" dir="ltr">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
          <p className="text-muted-foreground mt-1">Search parents and manage subscriptions</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search by name or email..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 max-w-md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Role</th>
                  <th className="p-4 font-medium">Children</th>
                  <th className="p-4 font-medium">Subscription</th>
                  <th className="p-4 font-medium">Plan</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : users?.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No users found.</td></tr>
                ) : (
                  users?.map(user => (
                    <tr key={user.id} className="hover:bg-muted/30">
                      <td className="p-4">
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <Badge variant={user.role === 'admin' ? 'destructive' : user.role === 'teacher' ? 'default' : 'secondary'}>
                          {user.role}
                        </Badge>
                      </td>
                      <td className="p-4 text-center">{user.childCount}</td>
                      <td className="p-4">
                        <Badge variant={
                          user.subscriptionStatus === 'active' ? 'default' : 
                          user.subscriptionStatus === 'trial' ? 'outline' : 
                          'secondary'
                        }>
                          {user.subscriptionStatus || 'none'}
                        </Badge>
                      </td>
                      <td className="p-4 text-muted-foreground capitalize">{user.plan || '-'}</td>
                      <td className="p-4 text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="p-4 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExtendTrial(user.id)} disabled={user.subscriptionStatus !== 'trial'}>
                              <CalendarPlus className="w-4 h-4 mr-2" /> Extend Trial
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCancelSub(user.id)} disabled={!['active', 'trial', 'past_due'].includes(user.subscriptionStatus)} className="text-destructive">
                              <ShieldAlert className="w-4 h-4 mr-2" /> Cancel Subscription
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
