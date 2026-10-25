// Thin wrapper over Netlify Blobs. Every call is best-effort: if storage is unavailable
// (local preview, outage) the site still works, it just skips caching and counting.
import { getStore } from "@netlify/blobs";

export function open(name) {
  try {
    if (globalThis.__TEST_BLOBS__) return globalThis.__TEST_BLOBS__(name);
    return getStore({ name, consistency: "strong" });
  } catch (e) { console.error("blobs unavailable:", e && e.message); return null; }
}
export async function getJSON(s, key) { try { return s ? await s.get(key, { type: "json" }) : null; } catch { return null; } }
export async function setJSON(s, key, value) { try { if (s) await s.setJSON(key, value); return !!s; } catch (e) { console.error("blobs write failed:", e && e.message); return false; } }

export async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}
