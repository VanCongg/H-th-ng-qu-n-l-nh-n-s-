/**
 * Every cache key the app uses, in one place, so an invalidation site and the
 * read that filled the entry cannot drift apart.
 */
export const cacheKeys = {
  /** One hydrated AuthUser - roles and permissions included. */
  authUser: (userId: number) => `auth:user:${userId}`,
  /** The single system settings row. */
  systemSettings: () => "system:settings",
};

/**
 * Permissions decide what a request may do, so a stale entry is a security
 * problem, not just a wrong number. Every write path invalidates explicitly;
 * this TTL is only the backstop for a path someone forgets to wire up.
 */
export const AUTH_USER_TTL_SECONDS = 60;

/** Changes only from the settings screen, and that write invalidates it. */
export const SYSTEM_SETTINGS_TTL_SECONDS = 600;
