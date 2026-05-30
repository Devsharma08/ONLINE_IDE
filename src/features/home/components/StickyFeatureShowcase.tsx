import { features } from "../content";
import { useActiveSection } from "../hooks/useActiveSection";

const StickyFeatureShowcase = () => {
  const { activeIndex, sectionRefs } = useActiveSection(features.length);

  return (
    <div className="relative w-full px-0 sm:px-4 lg:px-10" style={{ height: `${features.length * 100}vh` }}>
      <div className="sticky top-24 z-10 h-[72vh] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] sm:rounded-[2rem] md:top-32 md:h-[80vh]">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            className={`absolute inset-0 w-full h-full transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              activeIndex === index ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            {/* 1. Background Feature Screenshot Image */}
            <img
              src={feature.img}
              alt={feature.title}
              className={`absolute inset-0 w-full h-full object-cover transition-transform duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${
                activeIndex === index
                  ? "scale-100 translate-y-0"
                  : activeIndex > index
                    ? "scale-105 -translate-y-8"
                    : "scale-105 translate-y-8"
              }`}
            />

            {/* 2. Sleek Dark Gradient Overlay - guarantees text legibility on top of screenshots */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090a]/98 via-[#08090a]/75 to-transparent md:bg-gradient-to-r md:from-[#08090a]/98 md:via-[#08090a]/75 md:to-transparent z-10" />

            {/* 3. Text Overlays (Title and Description) */}
            <div
              className={`absolute top-0 left-0 z-20 flex h-full w-full flex-col justify-center px-6 py-8 transition-all delay-100 duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] sm:px-10 md:w-[55%] md:px-20 ${
                activeIndex === index ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
              }`}
            >
              <h2 
                className="mb-4 text-3xl font-extrabold leading-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] sm:text-4xl md:mb-6 md:text-5xl lg:text-6xl"
                dangerouslySetInnerHTML={{ __html: feature.title }}
              />
              <p 
                className="text-base leading-relaxed text-slate-300 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)] sm:text-lg md:text-xl font-sans"
                dangerouslySetInnerHTML={{ __html: feature.desc }}
              />
            </div>

          </div>
        ))}
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none pt-[35vh]">
        {features.map((feature, index) => (
          <div
            key={feature.title}
            ref={(element) => {
              sectionRefs.current[index] = element;
            }}
            className="w-full h-[100vh]"
          />
        ))}
      </div>
    </div>
  );
};

export default StickyFeatureShowcase;
