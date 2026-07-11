const ADJECTIVES = [
  'quiet', 'brave', 'swift', 'calm', 'bold', 'wise', 'dark', 'bright',
  'silver', 'golden', 'silent', 'hollow', 'ancient', 'wild', 'tender',
  'steady', 'gentle', 'sharp', 'cloudy', 'crimson', 'ashen', 'lunar',
  'frozen', 'dusty', 'misty', 'amber', 'cobalt', 'onyx', 'jade', 'sage',
  'stark', 'dusk', 'dawn', 'lone', 'still', 'thorn', 'velvet', 'ember',
  'iron', 'cedar', 'storm', 'mellow', 'faded', 'vivid', 'hollow', 'bare',
];

const NOUNS = [
  'river', 'shadow', 'echo', 'flame', 'stone', 'crow', 'peak', 'ridge',
  'tide', 'grove', 'dusk', 'comet', 'spark', 'vale', 'cliff', 'wolf',
  'hawk', 'birch', 'pine', 'oak', 'fog', 'gale', 'reef', 'basin',
  'forest', 'crest', 'marsh', 'ember', 'veil', 'current', 'drift', 'bloom',
  'horizon', 'anchor', 'shard', 'cipher', 'signal', 'haven', 'path', 'trace',
  'gate', 'void', 'core', 'pulse', 'thread', 'note', 'mask', 'door',
];

export function generatePseudonym(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}-${noun}`;
}
