/**
 * Content Playbook — Thread & Reply Templates
 * Source: whs_dataset.json  (merged from whs_1.json – whs17.json)
 * Run `node scripts/merge-whs-dataset.js` to regenerate after adding new source files.
 */

import rawPlaybook from '../../whs_dataset.json';

export interface PlaybookThread {
  title: string;
  content: string;
  category: string;
  type: 'text' | 'poll';
  pollOptions?: string[];
  creatorPersona: string;
  replies: PlaybookReply[];
}

export interface PlaybookReply {
  personaTag: string;
  content: string;
  sequenceOrder: number;
  replyToSequence?: number;
}

export const SEED_THREADS: PlaybookThread[] = rawPlaybook as unknown as PlaybookThread[];
