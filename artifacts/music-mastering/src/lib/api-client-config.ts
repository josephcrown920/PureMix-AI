import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";

// VITE_API_BASE_URL points to the API server origin (e.g. https://your-repl.replit.dev).
// When unset (local dev where the api-server proxies to Vite on the same origin),
// requests stay relative.
const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (baseUrl) {
  setBaseUrl(baseUrl);
}

/**
 * Wires Clerk's getToken into the generated API client so every request from
 * the web app carries an Authorization: Bearer <token> header.
 *
 * NOTE: Although the api-client-react comment discourages bearer tokens for
 * web apps (same-origin cookies normally suffice), our production deployment
 * splits frontend (Netlify) and API (Replit) across origins, so cookies are
 * not viable. Bearer tokens are required.
 */
export function ApiAuthBridge() {
  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken, isLoaded]);
  return null;
}
