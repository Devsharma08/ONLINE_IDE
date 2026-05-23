import BentoGrid from "../features/home/components/BentoGrid";
import DeveloperTerminalSection from "../features/home/components/DeveloperTerminalSection";
import HeroSection from "../features/home/components/HeroSection";
import StickyFeatureShowcase from "../features/home/components/StickyFeatureShowcase";

const Home = () => {
  return (
    <section className="flex h-full w-full flex-col items-center px-4 pt-24 sm:px-6">
      <HeroSection />
      <StickyFeatureShowcase />
      <BentoGrid />
      <DeveloperTerminalSection />
    </section>
  );
};

export default Home;
