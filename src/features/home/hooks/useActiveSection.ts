import { useEffect, useRef, useState } from "react";

export const useActiveSection = (sectionCount: number) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = sectionRefs.current.indexOf(entry.target as HTMLDivElement);
            if (index !== -1) {
              setActiveIndex(index);
            }
          }
        });
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0.1 },
    );

    sectionRefs.current.slice(0, sectionCount).forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [sectionCount]);

  return { activeIndex, sectionRefs };
};
