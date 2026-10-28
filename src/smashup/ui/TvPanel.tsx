"use client";

import { useState } from "react";

import { Button, Notice } from "@/components/ui/controls";

import { parseRoomCode } from "../lib/ids";
import { Dialog } from "./common";

/** Asks the server to show a shared game on the TV with this code. Returns why it failed, or null. */
async function linkTv(tv: string, room: string | null): Promise<string | null> {
  try {
    const res = await fetch(`/api/tv/screens/${tv}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "smash-up", room }),
      cache: "no-store",
    });
    if (res.ok) return null;
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return body?.message ?? "That didn't work. Try again in a moment.";
  } catch {
    return "Couldn't reach the server. Check the connection and try again.";
  }
}

/** Puts the shared game on a TV: the TV at /tv shows a code, and this phone types it. */
export function TvDialog({ room, onClose }: { room: string; onClose: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showing, setShowing] = useState<string | null>(null);
  const code = parseRoomCode(text);
  const host = typeof window === "undefined" ? "" : window.location.host.replace(/^www\./, "");

  const send = async (tv: string, target: string | null) => {
    setBusy(true);
    const failure = await linkTv(tv, target);
    setError(failure);
    setBusy(false);
    if (!failure) setShowing(target ? tv : null);
  };

  return (
    <Dialog title="Show on TV" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {showing ? (
          <>
            <p className="font-mono text-sm leading-relaxed text-ink">
              The board is on TV <span className="tracking-[0.2em]">{showing}</span>. Keep playing here and the TV
              follows along.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => void send(showing, null)}>
                Take it off the TV
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="font-mono text-xs leading-relaxed text-muted">
              On the TV, open <span className="text-ink">{host}/tv</span> in the browser, then type the code it shows
              here. Only this device needs to tap. The TV just watches.
            </p>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (code) void send(code, room);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="TV code"
                aria-label="TV code"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={7}
                data-autofocus
                className="w-36 border border-edge bg-bg px-3 py-2 font-mono text-sm uppercase tracking-[0.2em] text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 focus:border-accent focus:outline-none"
              />
              <Button type="submit" variant="primary" disabled={!code || busy}>
                {busy ? "Sending…" : "Show"}
              </Button>
            </form>
          </>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
      </div>
    </Dialog>
  );
}
