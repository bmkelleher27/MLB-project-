/**
 * Base URL for the backend API and socket connection.
 *
 * In production this MUST be provided via the `VITE_API_URL` build-time env var
 * (e.g. on Vercel). If it's missing in a production build we fall back to
 * localhost — which won't work for real users — so surface a loud console error
 * to make the misconfiguration obvious rather than silently broken.
 */
const configured = import.meta.env.VITE_API_URL;

if (import.meta.env.PROD && !configured) {
  // eslint-disable-next-line no-console
  console.error(
    'VITE_API_URL is not set for this production build; API calls will fall back to ' +
      'http://localhost:4000 and fail. Set VITE_API_URL to the backend URL and rebuild.'
  );
}

export const API_BASE = configured ?? 'http://localhost:4000';
