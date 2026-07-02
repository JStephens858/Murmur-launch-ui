import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 client for the physician web experience. Configuration comes from
 * env vars (see .env.example): AUTH0_DOMAIN, AUTH0_CLIENT_ID,
 * AUTH0_CLIENT_SECRET, AUTH0_SECRET, APP_BASE_URL.
 *
 * The middleware mounts /auth/login, /auth/logout, /auth/callback,
 * /auth/profile, /auth/access-token, and /auth/backchannel-logout.
 */
export const auth0 = new Auth0Client();
