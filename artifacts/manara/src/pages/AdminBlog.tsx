import React from 'react';
import { useListBlogPosts, useCreateBlogPost, getListBlogPostsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function AdminBlog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useListBlogPosts();
  const createMutation = useCreateBlogPost();

  const [isOpen, setIsOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({ slug: '', titleAr: '', excerptAr: '', contentAr: '', coverEmoji: '📝' });

  const handleSave = () => {
    if (!formData.slug || !formData.titleAr) {
      toast({ title: 'Error', description: 'Slug and Title are required', variant: 'destructive' });
      return;
    }

    createMutation.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBlogPostsQueryKey() });
        setIsOpen(false);
        setFormData({ slug: '', titleAr: '', excerptAr: '', contentAr: '', coverEmoji: '📝' });
        toast({ title: 'Success', description: 'Blog post created' });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto" dir="ltr">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blog CMS</h1>
          <p className="text-muted-foreground mt-1">Manage marketing blog posts</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="w-4 h-4 mr-2" /> New Post</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Create Blog Post</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4" dir="rtl">
              <div className="grid grid-cols-4 gap-4">
                <div className="col-span-1 grid gap-2">
                  <Label>Cover Emoji</Label>
                  <Input value={formData.coverEmoji} onChange={e => setFormData({...formData, coverEmoji: e.target.value})} className="text-2xl text-center" />
                </div>
                <div className="col-span-3 grid gap-2">
                  <Label>Slug (URL) <span className="text-xs text-muted-foreground" dir="ltr">e.g. how-to-study</span></Label>
                  <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} dir="ltr" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Title (Arabic)</Label>
                <Input value={formData.titleAr} onChange={e => setFormData({...formData, titleAr: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Excerpt</Label>
                <Textarea value={formData.excerptAr} onChange={e => setFormData({...formData, excerptAr: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Content (Markdown)</Label>
                <Textarea value={formData.contentAr} onChange={e => setFormData({...formData, contentAr: e.target.value})} className="min-h-[200px] font-mono" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending}>Publish Post</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="h-48 bg-muted animate-pulse rounded-xl" />
        ) : (
          posts?.map(post => (
            <Card key={post.id} className="overflow-hidden">
              <div className="h-24 bg-muted/50 border-b flex items-center justify-center text-4xl">
                {post.coverEmoji}
              </div>
              <CardHeader className="pb-2">
                <div className="text-xs text-muted-foreground mb-1">{new Date(post.publishedAt).toLocaleDateString()}</div>
                <CardTitle className="line-clamp-2" dir="rtl">{post.titleAr}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-3" dir="rtl">{post.excerptAr}</p>
                <div className="mt-4 text-xs font-mono bg-muted/50 p-1 rounded inline-block text-muted-foreground">/{post.slug}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
