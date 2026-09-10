import type { PromptLibraryItem } from './types'

// Curated, static v1 library. Every question asks about the sender's own
// experience; none invites judgment of a named or identifiable third party.
export const PROMPT_LIBRARY: PromptLibraryItem[] = [
  { key: 'work-brave-ask', question: 'What is one thing you wish you could ask for at work?', category: 'work', personas: ['career', 'hr', 'founder'] },
  { key: 'work-unseen-win', question: 'What is a work win nobody saw?', category: 'work', personas: ['career', 'founder'] },
  { key: 'work-boundary', question: 'What boundary made work better for you?', category: 'work', personas: ['career', 'wellbeing'] },
  { key: 'work-start-again', question: 'What would you do differently in your first year of work?', category: 'work', personas: ['career', 'mentor'] },
  { key: 'work-burnout-signal', question: 'What was the first sign you needed a break from work?', category: 'work', personas: ['career', 'wellbeing'] },
  { key: 'work-quiet-skill', question: 'What quiet skill has helped your career most?', category: 'work', personas: ['career', 'founder'] },
  { key: 'work-good-manager', question: 'What makes you feel trusted at work?', category: 'work', personas: ['career', 'hr'] },
  { key: 'work-risk', question: 'What career risk are you glad you took?', category: 'work', personas: ['career', 'founder'] },
  { key: 'work-real-advice', question: 'What career advice finally made sense after you lived it?', category: 'work', personas: ['career', 'mentor'] },

  { key: 'money-first-save', question: 'What did saving your first meaningful amount teach you?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-small-luxury', question: 'What small expense makes your life genuinely better?', category: 'money', personas: ['finance', 'lifestyle'] },
  { key: 'money-learned-late', question: 'What money lesson did you learn later than you wanted?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-worth-it', question: 'What is something you spend on that feels worth it every time?', category: 'money', personas: ['finance', 'lifestyle'] },
  { key: 'money-quiet-goal', question: 'What financial goal are you quietly working toward?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-hard-no', question: 'What purchase taught you to say no more often?', category: 'money', personas: ['finance'] },
  { key: 'money-home', question: 'What did your family teach you about money that you still carry?', category: 'money', personas: ['finance', 'family'] },
  { key: 'money-free', question: 'What would financial breathing room change for you?', category: 'money', personas: ['finance', 'young-adult'] },
  { key: 'money-smartest', question: 'What is the smartest simple money habit you have?', category: 'money', personas: ['finance'] },

  { key: 'love-safe', question: 'What makes you feel safe in a relationship?', category: 'love', personas: ['relationships'] },
  { key: 'love-lesson', question: 'What did love teach you about yourself?', category: 'love', personas: ['relationships'] },
  { key: 'love-small-thing', question: 'What small act of care means the most to you?', category: 'love', personas: ['relationships'] },
  { key: 'love-communication', question: 'What helped you become a better communicator?', category: 'love', personas: ['relationships', 'wellbeing'] },
  { key: 'love-ready', question: 'What does being ready for love mean to you now?', category: 'love', personas: ['relationships'] },
  { key: 'love-boundary', question: 'What relationship boundary are you proud of keeping?', category: 'love', personas: ['relationships'] },
  { key: 'love-unlearn', question: 'What are you unlearning about love?', category: 'love', personas: ['relationships'] },
  { key: 'love-home', question: 'What makes a relationship feel like home?', category: 'love', personas: ['relationships'] },
  { key: 'love-honesty', question: 'What honest conversation changed a relationship for the better?', category: 'love', personas: ['relationships'] },

  { key: 'family-grown', question: 'What is something your family helped you grow into?', category: 'family', personas: ['family', 'lifestyle'] },
  { key: 'family-tradition', question: 'What family tradition would you keep forever?', category: 'family', personas: ['family'] },
  { key: 'family-understood', question: 'What do you wish your family understood about you?', category: 'family', personas: ['family', 'young-adult'] },
  { key: 'family-care', question: 'What is a simple way your family shows care?', category: 'family', personas: ['family'] },
  { key: 'family-older', question: 'What did getting older help you understand about family?', category: 'family', personas: ['family'] },
  { key: 'family-memory', question: 'What family memory still makes you smile?', category: 'family', personas: ['family'] },
  { key: 'family-home', question: 'What makes a place feel like home to you?', category: 'family', personas: ['family', 'lifestyle'] },
  { key: 'family-gratitude', question: 'What is something you are grateful your family taught you?', category: 'family', personas: ['family'] },
  { key: 'family-change', question: 'What family habit are you choosing to do differently?', category: 'family', personas: ['family', 'wellbeing'] },

  { key: 'campus-survive', question: 'What helped you survive your hardest semester?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-lesson', question: 'What did school teach you outside the classroom?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-friend', question: 'What makes a campus friendship last?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-start', question: 'What would you tell yourself before your first semester?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-place', question: 'Where did you feel most like yourself on campus?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-pressure', question: 'How do you reset after a demanding week of school?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-proud', question: 'What academic moment are you quietly proud of?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-advice', question: 'What study habit actually works for you?', category: 'campus', personas: ['campus', 'student'] },
  { key: 'campus-future', question: 'What are you excited to learn next?', category: 'campus', personas: ['campus', 'student'] },

  { key: 'general-restart', question: 'What are you ready to start again?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-quiet-proud', question: 'What are you quietly proud of lately?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-life-easy', question: 'What has made life feel a little easier recently?', category: 'general', personas: ['lifestyle', 'wellbeing'] },
  { key: 'general-change-mind', question: 'What changed your mind in a good way?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-need-hear', question: 'What do you need to hear more often?', category: 'general', personas: ['lifestyle', 'wellbeing'] },
  { key: 'general-little-joy', question: 'What is a small thing bringing you joy right now?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-brave', question: 'What would you try if you knew you could not fail?', category: 'general', personas: ['lifestyle', 'creator'] },
  { key: 'general-recently-learned', question: 'What have you learned about yourself recently?', category: 'general', personas: ['lifestyle'] },
  { key: 'general-next-month', question: 'What would make next month feel meaningful?', category: 'general', personas: ['lifestyle', 'creator'] },
]

export const getLibraryPrompt = (key: string | null | undefined) =>
  PROMPT_LIBRARY.find((prompt) => prompt.key === key) ?? null
