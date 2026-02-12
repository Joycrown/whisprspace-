export const ANONYMOUS_SESSION_HOURS = 24;
export const REGISTERED_SESSION_HOURS = 72;
export const REMEMBER_ME_DAYS = 5;

const hoursToMs = (hours: number) => hours * 60 * 60 * 1000;

export const getAnonymousSessionExpiry = () =>
  new Date(Date.now() + hoursToMs(ANONYMOUS_SESSION_HOURS)).toISOString();

export const getRegisteredSessionExpiry = (rememberMe: boolean) => {
  const hours = rememberMe ? REMEMBER_ME_DAYS * 24 : REGISTERED_SESSION_HOURS;
  return new Date(Date.now() + hoursToMs(hours)).toISOString();
};
