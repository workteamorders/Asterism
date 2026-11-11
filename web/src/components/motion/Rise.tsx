"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Elements marked `data-rise` (optionally with a `--rise-order` style) ease into place when they scroll into view.
 * Elements already on screen are left alone, and nothing is hidden unless this effect has run and motion is allowed,
 * so without JavaScript or under reduced motion the content is simply there.
 */
export function Rise() {
  const pathname = usePathname();
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    if (!motion.matches) return;
    const seen = new IntersectionObserver(
      (entries) => {
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting) continue;
          target.setAttribute("data-rise", "in");
          seen.unobserve(target);
        }
      },
      { threshold: 0.15 },
    );
    const frame = requestAnimationFrame(() => {
      for (const element of document.querySelectorAll<HTMLElement>("[data-rise='']")) {
        if (element.getBoundingClientRect().top < innerHeight * 0.9) continue;
        element.setAttribute("data-rise", "wait");
        seen.observe(element);
      }
    });
    return () => {
      cancelAnimationFrame(frame);
      seen.disconnect();
    };
  }, [pathname]);
  return null;
}
