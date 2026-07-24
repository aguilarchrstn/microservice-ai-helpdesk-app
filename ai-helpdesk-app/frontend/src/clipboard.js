/**
 * Copies text to the clipboard, working on both secure (HTTPS/localhost)
 * and plain HTTP origins.
 *
 * The modern navigator.clipboard.writeText API only works in a "secure
 * context" — HTTPS or localhost. Served over plain http://<ip>:8080 (as
 * this app is by default), it's unavailable or silently rejects, which is
 * why copy buttons can appear to do nothing. This falls back to the older
 * textarea + execCommand('copy') approach, which still works over HTTP.
 *
 * Returns true if the copy succeeded, false otherwise.
 */
export async function copyText(text) {
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy fallback below.
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    // Keep it out of view and out of the layout flow.
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
