import { useEffect, useState } from "react";

export const UseHeadroom = () => {
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");

  useEffect(() => {
    let lastScrollY = window.pageYOffset;

    const scrollHandler = () => {
      const currentScrollY = window.pageYOffset || window.scrollY;

      if (Math.abs(currentScrollY - lastScrollY) < 10) {
        return;
      }

      setScrollDirection(currentScrollY > lastScrollY ? "down" : "up");
      lastScrollY = currentScrollY > 0 ? currentScrollY : 0;
    };

    window.addEventListener("scroll", scrollHandler);

    return () => window.removeEventListener("scroll", scrollHandler);
  }, []);

  return scrollDirection;
};
