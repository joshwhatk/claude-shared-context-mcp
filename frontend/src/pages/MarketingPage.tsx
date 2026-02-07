import { MarketingNav } from '../components/marketing/MarketingNav';
import { HeroSection } from '../components/marketing/HeroSection';

export function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <HeroSection />
    </div>
  );
}
