import type { PromptLibraryItem } from './types'

// Curated, static v1 library. Every question asks about the sender's own
// experience; none invites judgment of a named or identifiable third party.
// Each one aims for one concrete, specific angle rather than a generic
// self-help phrasing — the goal is a question people can't answer on autopilot.
export const PROMPT_LIBRARY: PromptLibraryItem[] = [
  { key: 'work-said-nothing', question: 'What did you not say in a meeting that you still think about?', category: 'work', personas: ['career', 'hr', 'founder'] },
  { key: 'work-fake-until', question: 'What skill on your resume did you learn on the job while pretending you already knew it?', category: 'work', personas: ['career', 'founder'] },
  { key: 'work-almost-quit', question: 'What was the closest you came to quitting without telling anyone?', category: 'work', personas: ['career', 'wellbeing'] },
  { key: 'work-wrong-hire', question: 'What is something you got hired to do that you were not actually qualified for?', category: 'work', personas: ['career', 'founder'] },
  { key: 'work-credit', question: 'What is something you did at work that someone else got credit for?', category: 'work', personas: ['career', 'hr'] },
  { key: 'work-pretend-busy', question: 'What do you do at your desk when you have nothing left to do but can’t leave?', category: 'work', personas: ['career'] },
  { key: 'work-turning-point', question: 'What is the exact moment you stopped caring about a job you used to love?', category: 'work', personas: ['career', 'wellbeing'] },
  { key: 'work-unspoken-rule', question: 'What unwritten rule at your workplace took you the longest to figure out?', category: 'work', personas: ['career', 'hr'] },
  { key: 'work-envy', question: 'What career move by someone in your circle made you quietly reconsider your own path?', category: 'work', personas: ['career', 'mentor'] },

  { key: 'money-hidden-purchase', question: 'What is something you bought that you hid from someone, and why?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-lied-about', question: 'What is the biggest lie you have told about money?', category: 'money', personas: ['finance'] },
  { key: 'money-cheap-on', question: 'What do you refuse to spend money on, even though you could afford it?', category: 'money', personas: ['finance', 'lifestyle'] },
  { key: 'money-envy-trigger', question: 'What kind of spending, when you see someone else do it, makes you feel something you don’t like admitting?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-first-real-number', question: 'What is the first amount of money that made you feel genuinely rich, even briefly?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-secret-debt', question: 'What financial number are you avoiding checking right now?', category: 'money', personas: ['finance'] },
  { key: 'money-family-silence', question: 'What did your family never talk about with money that you had to learn the hard way?', category: 'money', personas: ['finance', 'family'] },
  { key: 'money-would-sell', question: 'What would you sell if you were quietly desperate for cash, and what has stopped you so far?', category: 'money', personas: ['finance'] },
  { key: 'money-worth-the-guilt', question: 'What is a purchase you don’t regret, even though you probably should?', category: 'money', personas: ['finance', 'lifestyle'] },

  { key: 'love-said-too-late', question: 'What is something you wish you had said to someone before it was too late to say it?', category: 'love', personas: ['relationships'] },
  { key: 'love-red-flag-ignored', question: 'What warning sign did you notice and ignore anyway?', category: 'love', personas: ['relationships'] },
  { key: 'love-still-checking', question: 'What is a life you still quietly check up on, and what do you tell yourself about why?', category: 'love', personas: ['relationships'] },
  { key: 'love-unsent-text', question: 'What is a message you typed out and never sent?', category: 'love', personas: ['relationships'] },
  { key: 'love-became-like-parent', question: 'What is a relationship habit you swore you would never repeat, but did anyway?', category: 'love', personas: ['relationships', 'family'] },
  { key: 'love-first-real-fight', question: 'What was the first real fight that showed you who someone actually was?', category: 'love', personas: ['relationships'] },
  { key: 'love-easier-alone', question: 'What is something being alone taught you that a relationship never did?', category: 'love', personas: ['relationships'] },
  { key: 'love-wrong-reason-stayed', question: 'What is the real reason you stayed somewhere longer than you should have?', category: 'love', personas: ['relationships'] },
  { key: 'love-changed-the-story', question: 'What is a version of your own relationship history you have quietly rewritten to feel better about it?', category: 'love', personas: ['relationships'] },

  { key: 'family-first-secret', question: 'What is the first secret you ever kept from your family?', category: 'family', personas: ['family', 'young-adult'] },
  { key: 'family-noticed-too-late', question: 'What did you only understand about a parent after you were old enough to see them as a person?', category: 'family', personas: ['family'] },
  { key: 'family-role-you-play', question: 'What role do you always end up playing at family gatherings, and are you tired of it?', category: 'family', personas: ['family'] },
  { key: 'family-money-was-never-said', question: 'What is something your family communicated only through actions, never words?', category: 'family', personas: ['family'] },
  { key: 'family-different-now', question: 'What is something you believed about your family growing up that turned out to be untrue?', category: 'family', personas: ['family', 'young-adult'] },
  { key: 'family-hardest-call', question: 'What is a phone call to or from family you still remember exactly where you were standing?', category: 'family', personas: ['family'] },
  { key: 'family-repeat-pattern', question: 'What family pattern are you actively trying not to pass on?', category: 'family', personas: ['family', 'wellbeing'] },
  { key: 'family-proudest-quiet', question: 'What did you do that you wish a family member had seen, even though you never told them?', category: 'family', personas: ['family'] },
  { key: 'family-left-unsaid', question: 'What is something you and a family member both know but have never said out loud to each other?', category: 'family', personas: ['family'] },

  { key: 'campus-almost-failed', question: 'What is the closest you came to failing out, and who never found out?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-faked-understanding', question: 'What class did you pass while understanding almost none of it?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-wrong-crowd', question: 'What friend group changed you in a way you did not expect, for better or worse?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-cried-where', question: 'Where on campus did you go when you needed to fall apart without anyone seeing?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-chose-wrong', question: 'What choice did you make in school that you would take back if you could?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-envy-classmate', question: 'What classmate’s path made you quietly question your own, and what did that feeling teach you?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-secret-plan', question: 'What is something you were actually planning to do after graduation that you never told anyone?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-professor-moment', question: 'What is something a teacher or professor said to you that you still carry, for good or bad?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-different-person', question: 'Who were you pretending to be in your first semester, and when did you stop?', category: 'campus', personas: ['campus', 'student'] },

  { key: 'general-different-choice', question: 'What is one decision that quietly split your life into before and after?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-nobody-knows', question: 'What is something true about you that almost nobody in your life actually knows?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-envy-honest', question: 'What kind of life, when you see someone living it, makes you feel a version of envy you don’t like admitting?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-younger-self-wrong', question: 'What did your younger self get completely wrong about how life would go?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-still-embarrassed', question: 'What is something from years ago that still makes you cringe when you remember it?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-quiet-rule', question: 'What personal rule do you follow that you have never explained to anyone?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-would-say-drunk', question: 'What would you actually say if you knew there would be zero consequences?', category: 'general', personas: ['lifestyle', 'creator'] },
  { key: 'general-changed-by-a-stranger', question: 'What did a stranger once say to you that changed how you think, even briefly?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-still-waiting', question: 'What is something you are still quietly waiting to happen?', category: 'general', personas: ['lifestyle', 'creator'] },

  // Icebreakers: how well do people actually know you. The first two use the
  // choice format (creator marks a hidden true answer, participants guess,
  // creator sees a tally) — everything else in the library stays free-text.
  {
    key: 'icebreaker-three-truths',
    question: 'Which one of these is the lie?',
    category: 'icebreakers',
    personas: ['lifestyle', 'creator'],
    responseFormat: 'choice',
    options: ['', '', ''],
    correctOptionIndex: 0,
  },
  {
    key: 'icebreaker-never-have-i-ever',
    question: 'Which of these have I actually never done?',
    category: 'icebreakers',
    personas: ['lifestyle', 'creator'],
    responseFormat: 'choice',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
  },
  { key: 'icebreaker-best-memory', question: 'What is the best memory you have of me?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
  { key: 'icebreaker-worst-memory', question: 'What is the worst memory you have of me — the honest one?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
  { key: 'icebreaker-love-more', question: 'What do you think I love more than I let on?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
  { key: 'icebreaker-guess-fear', question: 'What do you think I am actually afraid of?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
  { key: 'icebreaker-guess-first-impression', question: 'What was your honest first impression of me?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
  { key: 'icebreaker-guess-changed', question: 'What do you think has changed about me that I have not noticed myself?', category: 'icebreakers', personas: ['lifestyle', 'creator'] },
]

export const getLibraryPrompt = (key: string | null | undefined) =>
  PROMPT_LIBRARY.find((prompt) => prompt.key === key) ?? null
