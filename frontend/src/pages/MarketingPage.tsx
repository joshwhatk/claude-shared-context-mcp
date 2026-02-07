import { MarketingNav } from '../components/marketing/MarketingNav';
import { HeroSection } from '../components/marketing/HeroSection';
import { ProblemSection } from '../components/marketing/ProblemSection';
import { ComparisonSection } from '../components/marketing/ComparisonSection';
import { HowItWorksSection } from '../components/marketing/HowItWorksSection';
import { UseCasesSection } from '../components/marketing/UseCasesSection';
import { WaitlistSection } from '../components/marketing/WaitlistSection';
import { Footer } from '../components/marketing/Footer';

export function MarketingPage() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingNav />
      <HeroSection />
      <ProblemSection />
      <ComparisonSection />
      <HowItWorksSection />
      <UseCasesSection />
      <WaitlistSection />
      <Footer />
    </div>
  );
}
