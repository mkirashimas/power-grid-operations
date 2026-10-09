'use client';

import { useEffect, useRef, useState } from 'react';

/** Messages per second over the last `windowMs`, from a running message count. */
export const useMessageRate = (count: number, windowMs = 5000) => {
  const latest = useRef(count);
  const samples = useRef<{ time: number; count: number }[]>([]);
  const [rate, setRate] = useState(0);

  useEffect(() => {
    latest.current = count;
  }, [count]);

  useEffect(() => {
    const timer = setInterval(() => {
      const time = performance.now();
      samples.current = [
        ...samples.current.filter((sample) => time - sample.time <= windowMs),
        { time, count: latest.current },
      ];
      const first = samples.current[0];
      const elapsed = time - first.time;
      setRate(elapsed > 0 ? ((latest.current - first.count) * 1000) / elapsed : 0);
    }, 1000);
    return () => clearInterval(timer);
  }, [windowMs]);

  return rate;
};
