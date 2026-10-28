import { Audience } from "@/components/landing/Audience";
import { Booking } from "@/components/landing/Booking";
import { Closing } from "@/components/landing/Closing";
import { CrowdMap } from "@/components/landing/CrowdMap";
import { Faq } from "@/components/landing/Faq";
import { Hero } from "@/components/landing/hero/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Pricing } from "@/components/landing/Pricing";
import { Problem } from "@/components/landing/Problem";

export default function Home() {
  return (
    <main>
      <Hero />
      <Problem />
      <HowItWorks />
      <CrowdMap />
      <Booking />
      <Audience />
      <Pricing />
      <Faq />
      <Closing />
    </main>
  );
}
