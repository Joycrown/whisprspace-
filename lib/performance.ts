/**
 * Performance Monitoring Utilities
 * Track and report Web Vitals and performance metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

// Web Vitals thresholds
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },  // First Contentful Paint
  LCP: { good: 2500, poor: 4000 },  // Largest Contentful Paint
  FID: { good: 100, poor: 300 },    // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },   // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 },  // Time to First Byte
  INP: { good: 200, poor: 500 },    // Interaction to Next Paint
};

// Rate metric as good, needs-improvement, or poor
function getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return 'good';
  
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

// Report Web Vitals to analytics
export function reportWebVitals(metric: PerformanceMetric) {
  const { name, value, rating, id } = metric;

  // Log to console in development


  // Send to analytics (implement your analytics provider)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', name, {
      value: Math.round(value),
      metric_id: id,
      metric_value: value,
      metric_rating: rating,
    });
  }

  // Send to custom analytics endpoint
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT) {
    fetch(process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: name,
        value,
        rating,
        id,
        timestamp: new Date().toISOString(),
      }),
      keepalive: true,
    }).catch(console.error);
  }
}

// Custom performance marks
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();

  start(label: string) {
    this.marks.set(label, performance.now());
  }

  end(label: string) {
    const startTime = this.marks.get(label);
    if (!startTime) {
      return;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(label);



    return duration;
  }

  measure(label: string, callback: () => void) {
    this.start(label);
    callback();
    return this.end(label);
  }

  async measureAsync<T>(label: string, callback: () => Promise<T>): Promise<T> {
    this.start(label);
    try {
      const result = await callback();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

// Create singleton instance
export const performanceTracker = new PerformanceTracker();

// Monitor long tasks (tasks > 50ms)
export function monitorLongTasks() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
    return;
  }

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
    ;
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  } catch (error) {
    console.error('Failed to observe long tasks:', error);
  }
}

// Get current performance metrics
export function getCurrentMetrics() {
  if (typeof window === 'undefined' || !performance) {
    return null;
  }

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const paint = performance.getEntriesByType('paint');

  return {
    // Navigation Timing
    domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.domContentLoadedEventStart,
    loadComplete: navigation?.loadEventEnd - navigation?.loadEventStart,
    
    // Paint Timing
    firstPaint: paint.find(entry => entry.name === 'first-paint')?.startTime,
    firstContentfulPaint: paint.find(entry => entry.name === 'first-contentful-paint')?.startTime,

    // Resource Timing
    totalResources: performance.getEntriesByType('resource').length,
  };
}

// Type definitions for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}
