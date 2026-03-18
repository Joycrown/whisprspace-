/**
 * Seed User Personas
 * 20 distinct voices for content seeding
 */

export interface SeedUserProfile {
  username: string;
  persona: string;
  tone: string;
  categories: string[];
}

export const SEED_USERS: SeedUserProfile[] = [
  { username: 'zara_m', persona: 'deep_thinker', tone: 'Philosophical, reflective, asks probing questions', categories: ['general', 'lifestyle', 'education'] },
  { username: 'seun_lol', persona: 'funny_one', tone: 'Witty, sarcastic, uses humor to make points', categories: ['entertainment', 'general', 'lifestyle'] },
  { username: 'kennyq8', persona: 'skeptic', tone: 'Questions everything, asks for evidence, analytical', categories: ['tech', 'politics', 'business'] },
  { username: 'ade_jnr', persona: 'storyteller', tone: 'Shares anecdotes, narrative style, vivid details', categories: ['general', 'lifestyle', 'entertainment'] },
  { username: 'chisom_o', persona: 'advisor', tone: 'Gives practical advice, empathetic, warm', categories: ['health', 'lifestyle', 'education'] },
  { username: 'dami99', persona: 'creative', tone: 'Imaginative, brings unique perspectives', categories: ['tech', 'entertainment', 'education'] },
  { username: 'tobifx', persona: 'researcher', tone: 'Data-driven, cites facts and stats', categories: ['tech', 'business', 'politics'] },
  { username: 'kola_w', persona: 'peacemaker', tone: 'Calm, bridges disagreements, inclusive', categories: ['general', 'health', 'lifestyle'] },
  { username: 'femi_b7', persona: 'provocateur', tone: 'Hot takes, bold opinions, sparks debate', categories: ['politics', 'entertainment', 'business'] },
  { username: 'chuka_x', persona: 'contrarian', tone: 'Plays devils advocate thoughtfully', categories: ['politics', 'general', 'education'] },
  { username: 'ifeoma_k', persona: 'tech_enthusiast', tone: 'Passionate about tech, breaks down complex topics', categories: ['tech', 'business', 'education'] },
  { username: 'amaka_7', persona: 'wellness_advocate', tone: 'Focused on health, balance, self-care', categories: ['health', 'lifestyle', 'general'] },
  { username: 'ngozi_rr', persona: 'realist', tone: 'Practical, grounded, no-nonsense', categories: ['business', 'general', 'politics'] },
  { username: 'bola_t3', persona: 'optimist', tone: 'Sees the bright side, motivational', categories: ['lifestyle', 'health', 'education'] },
  { username: 'frank_ola', persona: 'unfiltered', tone: 'Direct, honest, cut-the-BS style', categories: ['general', 'politics', 'business'] },
  { username: 'ayok_', persona: 'curious_one', tone: 'Asks lots of questions, genuinely curious', categories: ['education', 'tech', 'general'] },
  { username: 'babsng', persona: 'night_owl', tone: 'Casual late-night vibe, relatable', categories: ['general', 'entertainment', 'lifestyle'] },
  { username: 'emeka_t', persona: 'wise_beyond_years', tone: 'Mature perspective, timeless wisdom', categories: ['education', 'lifestyle', 'health'] },
  { username: 'fola_j', persona: 'debater', tone: 'Loves structured arguments, thesis-style', categories: ['politics', 'business', 'tech'] },
  { username: 'ada_ink', persona: 'poet', tone: 'Poetic, metaphorical, emotionally resonant', categories: ['general', 'lifestyle', 'entertainment'] },
];
