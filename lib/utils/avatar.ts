export const getAvatarUrl = (userId: string, style: 'avataaars' | 'bottts' | 'identicon' = 'avataaars') => {
  if (!userId) return `https://api.dicebear.com/7.x/${style}/svg?seed=anonymous`;
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${userId}`;
};
