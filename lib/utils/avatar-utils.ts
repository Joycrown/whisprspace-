/**
 * Get a random avatar URL from the available avatars
 * Returns a path to one of the 10 avatar images stored in public/avatars
 */
export const getRandomAvatar = (): string => {
  // We have 7 generated avatars plus 3 placeholders
  const avatarCount = 10;
  const randomIndex = Math.floor(Math.random() * avatarCount) + 1;
  return `/avatars/avatar-${randomIndex}.png`;
};

/**
 * List of all available avatar paths
 */
export const AVAILABLE_AVATARS = Array.from({ length: 10 }, (_, i) => `/avatars/avatar-${i + 1}.png`);
