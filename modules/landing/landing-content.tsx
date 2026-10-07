import { CapabilitiesSection } from "./components/sections/capabilities-section";
import { DemoCtaSection } from "./components/sections/demo-cta-section";
import { HeroSection } from "./components/sections/hero-section";
import { ProofStrip } from "./components/sections/proof-strip";
import { SafeguardsSection } from "./components/sections/safeguards-section";
import { SiteFooter } from "./components/sections/site-footer";
import { WorkflowSection } from "./components/sections/workflow-section";
import { SiteHeader } from "./components/site-header";
import AccessRequestsContent from "@/modules/access-requests/access-requests-content";

export default function LandingContent() {
  return (
    <div className="min-h-screen bg-[#07111f] text-slate-100 selection:bg-violet-400/30">
      <SiteHeader />

      <main>
        <HeroSection />
        <ProofStrip />
        <WorkflowSection />
        <CapabilitiesSection />
        <SafeguardsSection />
        <DemoCtaSection />
        <AccessRequestsContent />
      </main>

      <SiteFooter />
    </div>
  );
}
