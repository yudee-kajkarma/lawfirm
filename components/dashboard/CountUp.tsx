'use client';

import { animate, useMotionValue } from 'motion/react';
import { useEffect, useState } from 'react';

type Props = {
  value: number;
  duration?: number;
  format?: (n: number) => string;
};

/**
 * Animates an integer count from its previous render value to `value`.
 * On first mount this is 0 → value; on subsequent changes the animation
 * starts from the current rendered value so the digits don't flash.
 */
export function CountUp({ value, duration = 0.7, format }: Props) {
  const motionValue = useMotionValue(0);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [value, duration, motionValue]);

  return <>{format ? format(display) : display.toLocaleString()}</>;
}
