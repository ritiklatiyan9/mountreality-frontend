import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import PublicNav from "@/components/ui/public-nav";

export default function HeroSection() {
  const navigate = useNavigate();

  return (
    <section
      className="relative isolate w-full overflow-hidden bg-background text-sm pb-24 md:pb-36"
      role="region"
      aria-label="Mount Reality hero section"
    >
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-140px] h-[460px] w-[460px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-[-120px] right-[-60px] h-[380px] w-[380px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <PublicNav active="home" />

      <div className="relative z-10 mx-auto mt-16 flex max-w-3xl flex-col items-center px-6 text-center md:mt-20">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-medium text-muted-foreground backdrop-blur">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Built for multi-site real estate accounting
        </div>

        <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
          Every site&apos;s accounts,
          <br className="hidden md:block" /> under one roof.
        </h1>

        <p className="mt-6 max-w-2xl text-sm text-muted-foreground md:text-base">
          Mount Reality brings client ledgers, vendor payments, plot registries, commissions and
          cash flow into a single dashboard — so your whole team stays on the same numbers.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" className="rounded-full px-6" onClick={() => navigate("/signup")}>
            Get Started <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-6" onClick={() => navigate("/pricing")}>
            View Pricing
          </Button>
        </div>
      </div>
    </section>
  );
}
