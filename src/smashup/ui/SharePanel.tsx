"use client";

import { useEffect, useState } from "react";

import { Button, Notice } from "@/components/ui/controls";

import { parseRoomCode } from "../lib/ids";
import type { SyncStatus } from "../sync/client";
import { ConfirmButton, Dialog } from "./common";

const STATUS: Record<SyncStatus, { label: string; tone: string }> = {
  live: { label: "Live", tone: "text-accent" },
  offline: { label: "Offline, retrying", tone: "text-accent2" },
  gone: { label: "Ended", tone: "text-accent2" },
  full: { label: "Full", tone: "text-accent2" },
};

export const roomLink = (code: string) => `${window.location.origin}/smash-up?room=${code}`;

/** The code, a QR code and a link for the other phones at the table. */
function Invite({ code, onClose }: { code: string; onClose: () => void }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = roomLink(code);

  useEffect(() => {
    let cancelled = false;
    // Loaded only when someone opens this, so the page itself stays light.
    import("qrcode")
      .then((qr) => qr.toString(link, { type: "svg", margin: 1, color: { dark: "#f0f0f0", light: "#0a0a0a" } }))
      .then((markup) => !cancelled && setSvg(markup))
      .catch(() => !cancelled && setSvg(null));
    return () => {
      cancelled = true;
    };
  }, [link]);

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <Dialog title="Invite the table" onClose={onClose}>
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="font-mono text-xs leading-relaxed text-muted">
          Scan this on another phone, or open {window.location.host}/smash-up there and join with the code.
        </p>
        {svg ? (
          // The SVG is drawn here from this page's own link, not taken from anywhere else.
          <div
            role="img"
            aria-label={`QR code for ${link}`}
            className="w-56 border border-edge [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : (
          <div className="flex h-56 w-56 items-center justify-center border border-edge font-mono text-xs text-muted">
            Drawing the code…
          </div>
        )}
        <p className="font-mono text-4xl tracking-[0.3em] text-ink" aria-label={`Room code ${code.split("").join(" ")}`}>
          {code}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() =>
              navigator.clipboard
                ?.writeText(link)
                .then(() => setCopied(true))
                .catch(() => setCopied(false))
            }
          >
            {copied ? "Link copied" : "Copy link"}
          </Button>
          {canShare ? (
            <Button onClick={() => void navigator.share({ title: "Smash Up game", url: link }).catch(() => {})}>
              Share link
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/** Sharing controls on the board: share a local game, or the state of a shared one. */
export function ShareBar({
  room,
  status,
  pending,
  onShare,
  onLeave,
}: {
  /** The room code when the game is shared. */
  room: string | null;
  status: SyncStatus | null;
  /** Taps not yet confirmed by the server. */
  pending: number;
  onShare: () => Promise<string | null>;
  onLeave: () => void;
}) {
  const [inviting, setInviting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!room) {
    return (
      <section aria-label="Share" className="flex flex-col gap-2 border border-edge bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs leading-relaxed text-muted">
            Put this game on everyone&apos;s phone: all of them can tap, and the board stays the same on each.
          </p>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const failure = await onShare();
              setError(failure);
              setBusy(false);
              // The invitation opens as soon as the room exists.
              if (!failure) setInviting(true);
            }}
          >
            {busy ? "Sharing…" : "Share this game"}
          </Button>
        </div>
        {error ? <Notice tone="error">{error}</Notice> : null}
      </section>
    );
  }

  const state = status ? STATUS[status] : STATUS.live;
  return (
    <section aria-label="Shared game" className="flex flex-col gap-3 border border-edge bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs text-muted">
          Shared game <span className="tracking-[0.2em] text-ink">{room}</span> ·{" "}
          <span className={state.tone} aria-live="polite">
            {state.label}
            {pending && status !== "gone" && status !== "full" ? ` · ${pending} waiting to send` : ""}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          {status !== "gone" && status !== "full" ? <Button onClick={() => setInviting(true)}>Invite</Button> : null}
          <ConfirmButton confirmText="Tap again to leave" onConfirm={onLeave}>
            {status === "gone" || status === "full" ? "Carry on here" : "Leave"}
          </ConfirmButton>
        </div>
      </div>
      {status === "gone" ? (
        <Notice tone="error">
          This shared game has expired on the server (games are kept for two days after the last change). Carry on
          here and this phone keeps the board as it is.
        </Notice>
      ) : status === "full" ? (
        <Notice tone="error">This shared game can take no more changes. Carry on here on this phone.</Notice>
      ) : null}
      {inviting && room ? <Invite code={room} onClose={() => setInviting(false)} /> : null}
    </section>
  );
}

/** Join a shared game by its code. */
export function JoinForm({ onJoin }: { onJoin: (code: string) => void }) {
  const [text, setText] = useState("");
  const code = parseRoomCode(text);
  return (
    <section aria-label="Join a shared game" className="flex flex-col gap-2 border border-edge bg-card p-4">
      <h2 className="font-display text-2xl tracking-wide text-ink">Join a shared game</h2>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code) onJoin(code);
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Code"
          aria-label="Room code"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={7}
          className="w-36 border border-edge bg-bg px-3 py-2 font-mono text-sm uppercase tracking-[0.2em] text-ink placeholder:normal-case placeholder:tracking-normal placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <Button type="submit" variant="primary" disabled={!code}>
          Join
        </Button>
      </form>
      <p className="font-mono text-[0.65rem] text-muted">
        The five-character code is on the phone that shared the game, under Invite.
      </p>
    </section>
  );
}
