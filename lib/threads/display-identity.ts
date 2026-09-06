/**
 * Display-layer anonymity for thread contexts.
 *
 * Threads previously showed each sender's anonymous_id. That is a persistent
 * pseudonym: it is the same string in every thread, so anyone who ties it to a
 * real person once can attribute all of that person's past and future thread
 * activity. Users reported exactly this concern.
 *
 * These helpers strip sender identity from what is rendered. The underlying
 * sender_id is untouched, so replies still resolve their parent, notifications
 * still route, and moderation still works — only the label shown to humans
 * changes.
 *
 * Inbox, profile and DM surfaces are deliberately not covered here: those are
 * identity contexts by design (/message/<username> is a person's public handle).
 */

export const SELF_SENDER_LABEL = 'You'
export const CREATOR_SENDER_LABEL = 'Owner'

const INBOX_USER_LABEL = 'INBOX_USER'

/**
 * The label to render for a thread message sender, or null when the sender
 * should not be labelled at all.
 *
 * The whole app is anonymous, so tagging every message "Anonymous" restates
 * what the product already establishes and adds visual noise. Instead only the
 * two distinctions a reader actually needs are shown: your own messages ("You")
 * and the person who started the thread ("OP"). Everyone else is unlabelled —
 * their per-thread avatar is what distinguishes them.
 */
export function getThreadSenderLabel(
  senderId: string | undefined | null,
  currentUserId: string | undefined | null,
  existingLabel?: string | null,
  threadCreatorId?: string | undefined | null
): string | null {
  // Inbox-imported messages carry their own system label, which is already
  // anonymous and meaningful to the reader.
  if (existingLabel === INBOX_USER_LABEL) return INBOX_USER_LABEL

  if (senderId && currentUserId && senderId === currentUserId) {
    return SELF_SENDER_LABEL
  }

  if (senderId && threadCreatorId && senderId === threadCreatorId) {
    return CREATOR_SENDER_LABEL
  }

  return null
}

/**
 * Same as getThreadSenderLabel but always returns a string, for contexts like
 * image alt text and confirmation copy where an empty label reads badly.
 */
export function getThreadSenderLabelText(
  senderId: string | undefined | null,
  currentUserId: string | undefined | null,
  existingLabel?: string | null,
  threadCreatorId?: string | undefined | null
): string {
  return (
    getThreadSenderLabel(senderId, currentUserId, existingLabel, threadCreatorId) ||
    'this participant'
  )
}

/**
 * Avatars are seeded from sender_id, which produces a stable image per person
 * across every thread — the same linkability problem as the ID itself. Seeding
 * per (thread, sender) keeps avatars visually varied within a conversation
 * while making them useless for cross-thread correlation.
 */
export function getThreadAvatarSeed(
  senderId: string | undefined | null,
  threadId: string | undefined | null
): string {
  if (!senderId) return 'anonymous'
  if (!threadId) return senderId
  return `${threadId}:${senderId}`
}
