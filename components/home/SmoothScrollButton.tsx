'use client';

/**
 * @fileoverview SmoothScrollButton
 *
 * A `<button>` that smoothly scrolls to a target element by ID without
 * modifying the URL (no `#hash` appended). This avoids the browser's
 * default anchor-jump behaviour and keeps the address bar clean.
 *
 * @example
 * <SmoothScrollButton targetId="how-it-works" className="...">
 *   See How It Works
 * </SmoothScrollButton>
 */

import { ReactNode } from 'react';

interface SmoothScrollButtonProps {
  /** The `id` of the DOM element to scroll to. */
  targetId: string;
  /** Standard button class names. */
  className?: string;
  children: ReactNode;
}

export default function SmoothScrollButton({ targetId, className, children }: SmoothScrollButtonProps) {
  /**
   * Scroll the target element into view with native smooth behaviour.
   * Using `scrollIntoView` instead of `location.hash` avoids polluting
   * the browser history stack and keeps the URL clean.
   */
  const handleClick = () => {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  );
}
