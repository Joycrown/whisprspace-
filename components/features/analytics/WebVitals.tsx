'use client'

import { useEffect } from 'react';
import { useReportWebVitals } from 'next/web-vitals';
import { reportWebVitals } from '@/lib/performance';

export function WebVitals() {
  useReportWebVitals((metric) => {
    reportWebVitals({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
    });
  });

  // Monitor long tasks in development
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      import('@/lib/performance').then(({ monitorLongTasks }) => {
        monitorLongTasks();
      });
    }
  }, []);

  return null;
}
