const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text made safe to put between tags or inside a quoted attribute. */
export const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => ESCAPES[char]);
