import AppLoadingState from '@/components/ui/AppLoadingState'

// Without a route-level loading state, navigating to /threads paints nothing
// until the page mounts, then flashes the hydration skeleton. This keeps the
// same dark surface on screen for the whole transition.
export default function Loading() {
  return <AppLoadingState title="Opening your space..." />
}
