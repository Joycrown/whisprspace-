export type GatedFeature = 'inbox' | 'discussions' | 'create-discussion' | 'ask' | 'profile'

export interface FeatureGate {
  title: string
  body: string
  perks: string[]
  primaryLabel: string
  signupHref: string
  loginHref: string
  guestHref?: string
  guestLabel?: string
}

const auth = (params: Record<string, string>) => `/auth?${new URLSearchParams({ force: '1', ...params }).toString()}`

export const FEATURE_GATES: Record<GatedFeature, FeatureGate> = {
  inbox: {
    title: 'Find out what people really think',
    body: 'Get your own anonymous link. Share it, and friends tell you the truth. They never know it’s you reading.',
    perks: ['Your link is ready in 10 seconds', 'One-off confessions or full conversations', 'Nobody sees who sent what'],
    primaryLabel: 'Get my anonymous link',
    signupHref: auth({ view: 'signup', reason: 'inbox', redirect: '/inbox' }),
    loginHref: auth({ view: 'login', redirect: '/inbox' }),
  },
  discussions: {
    title: 'Say it. Hear everyone. Gone in 48 hours.',
    body: 'Anonymous discussions on the things people actually think about. Every discussion closes after 48 hours, so people say what they mean.',
    perks: ['No names, no followers, no history', 'Polls to see where everyone stands', 'A summary of what everyone said when it closes'],
    primaryLabel: 'Create an account',
    signupHref: auth({ view: 'signup', redirect: '/discussions' }),
    loginHref: auth({ view: 'login', redirect: '/discussions' }),
    guestHref: auth({ view: 'anonymous', redirect: '/discussions' }),
    guestLabel: 'Just browse as a guest',
  },
  'create-discussion': {
    title: 'Start a discussion',
    body: 'Ask what you can’t ask anywhere else. People answer honestly because nobody knows who they are.',
    perks: ['You stay anonymous', 'It closes after 48 hours', 'Get a summary of every perspective'],
    primaryLabel: 'Create an account',
    signupHref: auth({ view: 'signup', redirect: '/discussions/create' }),
    loginHref: auth({ view: 'login', redirect: '/discussions/create' }),
  },
  ask: {
    title: 'Ask the question you’d never ask face to face',
    body: 'Post one question, share the link, and collect honest answers. Or try an icebreaker: “Which of these is the lie?”',
    perks: ['Answers are anonymous', 'Only you see them until you share', 'Turn the best answers into slides'],
    primaryLabel: 'Ask my first question',
    signupHref: auth({ view: 'signup', reason: 'prompt', redirect: '/curiosity-ask/create' }),
    loginHref: auth({ view: 'login', redirect: '/curiosity-ask' }),
  },
  profile: {
    title: 'Your space, still anonymous',
    body: 'Keep your stories, messages and discussions in one place. No real name, no photo, no email shown to anyone.',
    perks: ['Save and manage your stories', 'Your own anonymous link and asks', 'Get notified when people reply'],
    primaryLabel: 'Create an account',
    signupHref: auth({ view: 'signup', redirect: '/profile' }),
    loginHref: auth({ view: 'login', redirect: '/profile' }),
  },
}

export interface NavViewer {
  hasSession: boolean
  isRegistered: boolean
}

export function gateFor(feature: GatedFeature, viewer: NavViewer): GatedFeature | null {
  if (viewer.isRegistered) return null
  if (viewer.hasSession && feature === 'discussions') return null
  return feature
}
