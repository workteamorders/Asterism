"use client";

import { useEffect } from "react";

const lensSelector = "[data-inspection], [data-magnet]:not(:disabled):not([aria-disabled=true]):not([aria-busy=true])";

export function InstrumentMotion() {
  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: no-preference)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let active: HTMLElement | null = null;
    let bounds: DOMRect | null = null;

    function clear() {
      active?.removeAttribute("data-tracking");
      active = null;
      bounds = null;
    }

    function move(event: PointerEvent) {
      if (!motion.matches || !fine.matches || event.pointerType === "touch") return clear();
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>(lensSelector) : null;
      if (target !== active) clear();
      if (!target) return;
      if (!bounds) {
        active = target;
        bounds = target.getBoundingClientRect();
        target.dataset.tracking = "";
      }
      const unit = (point: number, start: number, size: number) =>
        Math.max(-1, Math.min(1, 2 * (point - start) / Math.max(1, size) - 1));
      target.style.setProperty("--pointer-x", String(unit(event.clientX, bounds.left, bounds.width)));
      target.style.setProperty("--pointer-y", String(unit(event.clientY, bounds.top, bounds.height)));
    }

    const reveal = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (!isIntersecting) continue;
        if (motion.matches) target.classList.add("section-enter");
        target.setAttribute("data-revealed", "");
        reveal.unobserve(target);
      }
    }, { threshold: 0.05 });
    function observeSections() {
      for (const section of document.querySelectorAll("[data-reveal]:not([data-revealed])")) reveal.observe(section);
    }
    const navigation = new MutationObserver(observeSections);
    navigation.observe(document.querySelector("main")?.parentElement ?? document.body, { subtree: true, childList: true });
    observeSections();

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", clear);
    window.addEventListener("scroll", clear, { passive: true, capture: true });
    window.addEventListener("resize", clear);
    document.documentElement.addEventListener("pointerleave", clear);
    return () => {
      clear();
      reveal.disconnect();
      navigation.disconnect();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", clear);
      window.removeEventListener("scroll", clear, true);
      window.removeEventListener("resize", clear);
      document.documentElement.removeEventListener("pointerleave", clear);
    };
  }, []);

  return null;
}
