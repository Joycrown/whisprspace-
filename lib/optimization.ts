/**
 * Optimization Utilities
 * Helper functions for performance optimization
 */

// Lazy load components with retry logic
export function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  retries = 3
): Promise<{ default: T }> {
  return new Promise((resolve, reject) => {
    componentImport()
      .then(resolve)
      .catch((error) => {
        if (retries === 0) {
          reject(error);
          return;
        }

        // Retry after a delay
        setTimeout(() => {
          lazyWithRetry(componentImport, retries - 1)
            .then(resolve)
            .catch(reject);
        }, 1000);
      });
  });
}

// Preload resources
export function preloadResource(href: string, as: string) {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = as;
  link.href = href;
  document.head.appendChild(link);
}

// Prefetch pages
export function prefetchPage(url: string) {
  if (typeof window === 'undefined') return;

  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  document.head.appendChild(link);
}

// Debounce function for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Intersection Observer for lazy loading
export function createLazyObserver(
  callback: (entry: IntersectionObserverEntry) => void,
  options?: IntersectionObserverInit
) {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        callback(entry);
      }
    });
  }, {
    rootMargin: '50px',
    ...options,
  });
}

// Check if device prefers reduced motion
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Get connection quality
export function getConnectionQuality(): 'slow' | 'medium' | 'fast' {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return 'medium';
  }

  const connection = (navigator as any).connection;
  const effectiveType = connection?.effectiveType;

  if (effectiveType === 'slow-2g' || effectiveType === '2g') {
    return 'slow';
  }

  if (effectiveType === '3g') {
    return 'medium';
  }

  return 'fast';
}

// Optimize image loading based on connection
export function getOptimalImageQuality(): number {
  const quality = getConnectionQuality();

  switch (quality) {
    case 'slow':
      return 50;
    case 'medium':
      return 75;
    case 'fast':
    default:
      return 90;
  }
}

// Check if user has data saver enabled
export function hasDataSaver(): boolean {
  if (typeof window === 'undefined' || !('connection' in navigator)) {
    return false;
  }

  const connection = (navigator as any).connection;
  return connection?.saveData === true;
}
