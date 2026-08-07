import { Hero } from '@/components/Hero';
import { Scrollytelling } from '@/components/Scrollytelling';
import { BrickWall } from '@/components/BrickWall';
import { CTA } from '@/components/CTA';
import { Footer } from '@/components/Footer';

export default function Home() {
  return (
    <main className="w-full relative flex flex-col bg-background selection:bg-primary/30 min-h-screen">
      <Hero />
      <Scrollytelling />
      <BrickWall />
      <CTA />
      <Footer />
    </main>
  );
}
