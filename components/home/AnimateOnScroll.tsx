'use client';

/**
 * @fileoverview AnimateOnScroll
 *
 * A lightweight wrapper that uses IntersectionObserver to trigger a CSS
 * animation class the moment an element enters the viewport. Starts
 * invisible (`opacity: 0`) and becomes visible exactly once — no
 * re-triggering on scroll-up.
 *
 * All animation classes (animate-es-*) are defined in `app/animations.css`.
 *
 * @example
 * // Fade up with a 200ms stagger delay
 * <AnimateOnScroll variant="fade-up" delay={200}>
 *   <MyCard />
 * </AnimateOnScroll>
 */

import { useEffect, useRef, ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnimationVariant =
  | 'fade-up' // Hero / general — soft upward glide
  | 'fade-left' // Problem cards — sweep from left
  | 'fade-right' // Solution outputs — sweep from right
  | 'scale-in' // Hub node / headers — bouncy expand
  | 'flip-up' // How It Works steps — 3-D flip
  | 'pop-in' // Feature cards — overshoot pop
  | 'glow-rise'; // CTA — brightness bloom rise

interface AnimateOnScrollProps {
  /** Content to animate. */
  children: ReactNode;
  /** Which keyframe animation to trigger on enter. */
  variant?: AnimationVariant;
  /** Delay in milliseconds before the animation starts. Useful for stagger. */
  delay?: number;
  /** Extra Tailwind / CSS classes on the wrapper element. */
  className?: string;
  /**
   * Fraction of the element that must be visible before triggering.
   * @default 0.12
   */
  threshold?: number;
}

// ---------------------------------------------------------------------------
// Variant → CSS class map (defined in animations.css)
// ---------------------------------------------------------------------------

const ANIMATION_CLASS: Record<AnimationVariant, string> = {
  'fade-up': 'animate-es-fade-up',
  'fade-left': 'animate-es-fade-left',
  'fade-right': 'animate-es-fade-right',
  'scale-in': 'animate-es-scale-in',
  'flip-up': 'animate-es-flip-up',
  'pop-in': 'animate-es-pop-in',
  'glow-rise': 'animate-es-glow-rise',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnimateOnScroll({ children, variant = 'fade-up', delay = 0, className = '', threshold = 0.12 }: AnimateOnScrollProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        // Apply the animation after the requested delay
        const timer = setTimeout(() => {
          el.classList.add(ANIMATION_CLASS[variant]);
          // Remove the opacity-0 override so the animation `from` state takes over
          el.style.opacity = '';
        }, delay);

        // Animate only once
        observer.unobserve(el);
        return () => clearTimeout(timer);
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [variant, delay, threshold]);

  return (
    <div
      ref={ref}
      className={className}
      /* Invisible until IntersectionObserver fires. The animation's
         fill-mode:both keeps the from-state (opacity:0) during delay. */
      style={{ opacity: 0 }}>
      {children}
    </div>
  );
}
