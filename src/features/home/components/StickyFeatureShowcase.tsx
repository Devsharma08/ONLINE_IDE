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

            <div className="absolute inset-0 bg-gradient-to-t from-darkbg/95 via-darkbg/80 to-transparent md:bg-gradient-to-r md:via-darkbg/70"></div>

            <div
              className={`absolute inset-0 flex w-full flex-col justify-end px-5 py-8 transition-all delay-100 duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] sm:px-8 md:w-[60%] md:justify-center md:px-20 md:py-0 ${
                activeIndex === index ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-12"
              }`}
            >
              <h2 className="mb-4 text-3xl font-extrabold leading-tight text-textwhite drop-shadow-2xl sm:text-4xl md:mb-6 md:text-6xl">
                {feature.title}
              </h2>
              <p className="text-base leading-relaxed text-textdimwhite drop-shadow-lg sm:text-lg md:text-xl">
                {feature.desc}
              </p>
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
