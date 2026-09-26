export const isAppDeployment = process.env.NEXT_PUBLIC_DEPLOYMENT_TARGET === 'app'
export const storiesFrontDoor = process.env.NEXT_PUBLIC_STORIES_FRONT_DOOR?.trim().toLowerCase() !== 'off'
export const storiesIsHome = isAppDeployment && storiesFrontDoor
export const STORIES_FEED_PATH = storiesIsHome ? '/' : '/stories'

export function isStoriesPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  if (pathname === '/') return storiesIsHome
  return pathname === '/stories' || pathname.startsWith('/stories/')
}

export function isStoryReaderPath(pathname: string | null | undefined): boolean {
  if (!pathname?.startsWith('/stories/')) return false
  const rest = pathname.slice('/stories/'.length)
  return Boolean(rest) && rest !== 'new' && !rest.includes('/')
}
