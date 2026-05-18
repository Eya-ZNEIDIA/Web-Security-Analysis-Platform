/**
 * Shared URL validation & sanitization helpers.
 * Use these across all dashboard / admin pages to prevent
 * MongoDB ObjectIds, UUIDs and hashes from leaking into the UI.
 */

/** Returns true if the value looks like a real URL / domain (not an ID) */
export const isLikelyUrl = (v) => {
  const s = String(v || "").trim();
  if (!s || s === "N/A" || s === "—") return false;
  if (/^[a-f0-9]{24}$/i.test(s)) return false;          // MongoDB ObjectId
  if (/^[a-f0-9]{32}$/i.test(s)) return false;          // MD5 hash
  if (/^[a-f0-9-]{36}$/i.test(s)) return false;         // UUID
  if (/^[a-f0-9]{40,}$/i.test(s)) return false;         // SHA hash
  if (!/[a-zA-Z]/.test(s)) return false;                 // must contain letters
  const bare = s.replace(/^https?:\/\//i, "");
  if (!/\./.test(bare)) return false;                    // must have a dot
  return true;
};

/** Returns true if the value looks like a technical ID (ObjectId, UUID, hash) */
export const isTechnicalId = (v) => {
  const s = String(v || "").trim();
  if (/^[a-f0-9]{24}$/i.test(s)) return true;
  if (/^[a-f0-9]{32}$/i.test(s)) return true;
  if (/^[a-f0-9-]{36}$/i.test(s)) return true;
  if (/^[a-f0-9]{40,}$/i.test(s)) return true;
  return false;
};

/** Extract the hostname from a URL string */
export const extractDomain = (url) => {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname;
  } catch {
    return String(url || "").replace(/^https?:\/\//i, "").split("/")[0];
  }
};

/** Google favicon URL for a domain */
export const faviconUrl = (url) => {
  const domain = extractDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
};

/** Clean a URL for display — return the URL or a fallback label */
export const displayUrl = (url, fallback = "Scan inconnu") => {
  return isLikelyUrl(url) ? url : fallback;
};

/** Short ID for display — last 6 chars, never the full ObjectId */
export const shortId = (id) => {
  const s = String(id || "");
  if (s.length > 12) return `…${s.slice(-6)}`;
  return s;
};
