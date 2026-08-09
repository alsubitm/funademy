import { motion } from 'framer-motion';
import { Link2, Share2, Check } from 'lucide-react';
import { useState } from 'react';
import { BrickIcon } from './Icons';
import { useToast } from '@/hooks/use-toast';

const SHARE_TEXT =
  'وضعت مكعّبي في جدار الوطن! 🧱 شاركونا في حملة «أطفالنا يبنون وطننا» وضعوا مكعّبكم أنتم أيضاً:';

function getShareUrl() {
  return window.location.origin + import.meta.env.BASE_URL;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function ShareCard() {
  const shareUrl = getShareUrl();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ description: 'تم نسخ الرابط بنجاح ✅' });
    } catch {
      toast({ description: 'تعذّر نسخ الرابط، انسخه يدوياً: ' + shareUrl, variant: 'destructive' });
    }
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text: SHARE_TEXT, url: shareUrl });
      } catch {
        // user cancelled the share sheet — do nothing
      }
    } else {
      await copyLink();
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${SHARE_TEXT} ${shareUrl}`)}`;
  const xHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(shareUrl)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="mt-10 w-full max-w-[560px] mx-auto bg-card border border-secondary/30 rounded-2xl p-6 md:p-8 shadow-2xl shadow-secondary/10 text-center"
      data-testid="card-share"
    >
      <div className="flex items-center justify-center gap-2 text-secondary font-black text-xl md:text-2xl">
        <BrickIcon className="w-6 h-6 md:w-7 md:h-7" />
        <span>مكعّبك صار جزءاً من الوطن!</span>
      </div>
      <p className="mt-3 text-muted-foreground text-sm md:text-base">
        شارك الحملة مع عائلتك وأصدقائك — كل مشاركة تعني مكعّبات أكثر في جدار الوطن.
      </p>
      <div className="mt-6 flex flex-col sm:flex-row items-stretch justify-center gap-3">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="button-share-whatsapp"
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#25D366] text-white font-bold text-sm md:text-base hover:brightness-110 transition-all shadow-lg shadow-[#25D366]/20"
        >
          <WhatsAppIcon className="w-5 h-5" />
          <span>شارك عبر واتساب</span>
        </a>
        <a
          href={xHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="button-share-x"
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-foreground text-background font-bold text-sm md:text-base hover:brightness-90 transition-all shadow-lg"
        >
          <XIcon className="w-5 h-5" />
          <span>شارك على X</span>
        </a>
        <button
          type="button"
          onClick={nativeShare}
          data-testid="button-share-native"
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-secondary text-secondary-foreground font-bold text-sm md:text-base hover:brightness-110 transition-all shadow-lg shadow-secondary/20"
        >
          <Share2 className="w-5 h-5" />
          <span>مشاركة</span>
        </button>
        <button
          type="button"
          onClick={copyLink}
          data-testid="button-copy-link"
          className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-secondary/40 text-foreground font-bold text-sm md:text-base hover:bg-secondary/10 transition-all"
        >
          {copied ? <Check className="w-5 h-5 text-secondary" /> : <Link2 className="w-5 h-5" />}
          <span>{copied ? 'تم النسخ' : 'نسخ الرابط'}</span>
        </button>
      </div>
    </motion.div>
  );
}
