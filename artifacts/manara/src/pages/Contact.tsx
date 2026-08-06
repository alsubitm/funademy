import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Mail, MapPin, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const contactSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function Contact() {
  const { t, dir } = useI18n();
  const { toast } = useToast();

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  const onSubmit = (data: ContactForm) => {
    // Mock submit
    toast({
      title: t('تم إرسال رسالتك بنجاح', 'Message sent successfully'),
      description: t('سنتواصل معك في أقرب وقت ممكن.', 'We will get back to you as soon as possible.'),
    });
    form.reset();
  };

  return (
    <div className="py-24 bg-muted/20 min-h-screen">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold mb-4">{t('تواصل معنا', 'Contact Us')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('نحن هنا للإجابة على استفساراتك ومساعدتك في توفير أفضل تجربة تعليمية لأبنائك.', 'We are here to answer your questions and help you provide the best educational experience for your children.')}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1 space-y-6">
            <Card>
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{t('البريد الإلكتروني', 'Email')}</h3>
                  <p className="text-muted-foreground text-sm" dir="ltr">support@manara.sa</p>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{t('رقم الهاتف', 'Phone')}</h3>
                  <p className="text-muted-foreground text-sm" dir="ltr">+966 50 000 0000</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6 flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold mb-1">{t('العنوان', 'Address')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t('الرياض، المملكة العربية السعودية', 'Riyadh, Saudi Arabia')}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold mb-6">{t('أرسل رسالة', 'Send a Message')}</h2>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('الاسم', 'Name')}</FormLabel>
                            <FormControl>
                              <Input placeholder={t('الاسم الكامل', 'Full Name')} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('البريد الإلكتروني', 'Email')}</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="name@example.com" dir="ltr" className={dir === 'rtl' ? 'text-right' : ''} {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t('الرسالة', 'Message')}</FormLabel>
                          <FormControl>
                            <Textarea 
                              placeholder={t('كيف يمكننا مساعدتك؟', 'How can we help you?')} 
                              className="min-h-[150px] resize-none"
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" size="lg" className="w-full md:w-auto px-8">
                      {t('إرسال', 'Send Message')}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
