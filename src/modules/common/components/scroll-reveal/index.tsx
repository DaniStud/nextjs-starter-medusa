"use client"

import React, { useEffect, useRef, useState } from "react"

/**
 * Direction the content slides in FROM:
 *  - "up"    → starts below, slides up (default — matches previous behavior)
 *  - "down"  → starts above, slides down
 *  - "left"  → starts left, slides in rightwards
 *  - "right" → starts right, slides in leftwards
 *  - "none"  → fade only
 */
type Direction = "up" | "down" | "left" | "right" | "none"

type ScrollRevealProps = {
  children: React.ReactNode
  className?: string
  /** Base delay in ms before the reveal starts */
  delay?: number
  /** Slide-in direction (see above) */
  direction?: Direction
  /** Also scale from 95% → 100% while revealing */
  scale?: boolean
  /**
   * When > 0, each direct child is revealed individually with this many
   * ms between them (children are wrapped in a plain <div>). Put grid /
   * flex classes on `className` — the wrappers become the grid items.
   */
  stagger?: number
  /** Transition duration in ms */
  duration?: number
  /** IntersectionObserver threshold */
  threshold?: number
  /** Reveal only the first time the element enters the viewport */
  once?: boolean
}

const hiddenTransform = (direction: Direction, scale: boolean): string => {
  const translate =
    {
      up: "translateY(2.5rem)",
      down: "translateY(-2.5rem)",
      left: "translateX(-2.5rem)",
      right: "translateX(2.5rem)",
      none: "translate(0, 0)",
    }[direction] ?? "translateY(2.5rem)"

  return scale ? `${translate} scale(0.95)` : translate
}

const ScrollReveal = ({
  children,
  className = "",
  delay = 0,
  direction = "up",
  scale = false,
  stagger = 0,
  duration = 700,
  threshold = 0.1,
  once = true,
}: ScrollRevealProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Respect reduced motion: show content immediately.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, once])

  const revealStyle = (extraDelay: number): React.CSSProperties => ({
    transitionProperty: "opacity, transform",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
    transitionDuration: `${duration}ms`,
    transitionDelay: `${delay + extraDelay}ms`,
    opacity: isVisible ? 1 : 0,
    transform: isVisible ? "none" : hiddenTransform(direction, scale),
    willChange: "opacity, transform",
  })

  // Staggered mode — wrap each direct child so it animates individually.
  if (stagger > 0) {
    const items = React.Children.toArray(children)

    return (
      <div ref={ref} className={className}>
        {items.map((child, i) => (
          <div key={i} style={revealStyle(i * stagger)}>
            {child}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={ref} className={className} style={revealStyle(0)}>
      {children}
    </div>
  )
}

export default ScrollReveal
