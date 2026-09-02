"use client";

import { useEffect, useRef } from "react";

export function ParallaxRoot({
  children,
  className,
  variant,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let frame = 0;

    const onPointer = (event: PointerEvent) => {
      const box = root.getBoundingClientRect();
      targetX = ((event.clientX - box.left) / box.width - 0.5) * 2;
      targetY = ((event.clientY - box.top) / box.height - 0.5) * 2;
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.07;
      currentY += (targetY - currentY) * 0.07;
      root.style.setProperty("--mx", currentX.toFixed(3));
      root.style.setProperty("--my", currentY.toFixed(3));
      frame = requestAnimationFrame(tick);
    };

    root.addEventListener("pointermove", onPointer);
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      root.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div ref={rootRef} className={className} data-variant={variant}>
      {children}
    </div>
  );
}
