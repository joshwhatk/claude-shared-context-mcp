import { MarketingNav } from '../components/marketing/MarketingNav';
import { HeroSection } from '../components/marketing/HeroSection';
import { ProblemSection } from '../components/marketing/ProblemSection';
import { HowItWorksSection } from '../components/marketing/HowItWorksSection';
import { UseCasesSection } from '../components/marketing/UseCasesSection';

export function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <UseCasesSection />
    </div>
  );
}
