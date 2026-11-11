"use client";

import { useEffect, useRef } from "react";

export function Fieldscape() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const reticle = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let disposed = false;
    let idle = 0;
    let cleanup: (() => void) | undefined;
    const mount = () => {
      void import("./draw").then(({ mountField }) => {
        if (!disposed && canvas.current && reticle.current) cleanup = mountField(canvas.current, reticle.current);
      });
    };
    const ready = () => { idle = window.requestIdleCallback(mount); };
    const hasIdle = typeof window.requestIdleCallback === "function";
    const afterLoad = hasIdle ? ready : mount;
    if (document.readyState === "complete") afterLoad();
    else window.addEventListener("load", afterLoad, { once: true });
    return () => {
      disposed = true;
      if (idle) window.cancelIdleCallback(idle);
      window.removeEventListener("load", afterLoad);
      cleanup?.();
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className="measurement-field" aria-hidden="true" />
      <span ref={reticle} className="cursor-reticle" aria-hidden="true" hidden />
    </>
  );
}
