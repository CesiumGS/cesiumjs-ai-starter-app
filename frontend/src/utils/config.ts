/**
 * Base URL the backend chat API is reachable at. Defaults to the local backend
 * dev server (`http://localhost:3001`); override with `VITE_API_BASE_URL` for
 * other environments. The chat endpoint is this base joined with `/api/chat`.
 */
const apiBaseUrl = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3001"
).replace(/\/+$/, "");

export const config = {
  cesiumIonToken: import.meta.env.VITE_CESIUM_ION_ACCESS_TOKEN as string | undefined,
  chatApiEndpoint: `${apiBaseUrl}/api/chat`,
};
