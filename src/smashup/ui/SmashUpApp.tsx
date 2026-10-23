"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Notice } from "@/components/ui/controls";

import { makeEntry } from "../lib/actions";
import { replay } from "../lib/game";
import { historyEntry, withGame } from "../lib/history";
import { parseRoomCode } from "../lib/ids";
import { useSavedState } from "../state/store";
import { SyncError, httpTransport, sharingAvailable, type SyncSnapshot } from "../sync/client";
import { useRoomSync } from "../sync/useRoomSync";
import type { Action, Entry } from "../types";
import { Board } from "./Board";
import { HistoryPanel } from "./HistoryPanel";
import { SetupPanel, type SetupPreset } from "./SetupPanel";
import { JoinForm, ShareBar } from "./SharePanel";
import { useWakeLock, useWakeLockSupported } from "./useWakeLock";

const TABS = [
  { id: "board", label: "Board" },
  { id: "setup", label: "New game" },
  { id: "history", label: "History" },
] as const;

type Tab = (typeof TABS)[number]["id"];

const NO_ENTRIES: Entry[] = [];

export function SmashUpApp() {
  const { state, update, loaded } = useSavedState();
  const [tab, setTab] = useState<Tab | null>(null);
  /** Whether this site has sharing switched on; unknown until the server answers. */
  const [canShare, setCanShare] = useState<boolean | null>(null);
  /** A rematch's players and settings for the New game form, and a count that remounts the form for each one. */
  const [rematch, setRematch] = useState<{ preset: SetupPreset; n: number } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const linked = parseRoomCode(useSearchParams().get("room"));

  useEffect(() => {
    void sharingAvailable().then(setCanShare);
  }, []);

  useEffect(() => {
    // Lets the page open with no signal once it has been opened online. Production only: the dev server changes
    // its files on every edit.
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/smash-up-sw.js", { scope: "/smash-up", updateViaCache: "none" }).catch(() => {
      // Without it the page still works; it just needs a connection to open.
    });
  }, []);

  const startRematch = (preset: SetupPreset) => {
    setRematch((prev) => ({ preset, n: (prev?.n ?? 0) + 1 }));
    setTab("setup");
  };

  const game = state.game;
  const room = game?.kind === "shared" ? game.room : null;
  const saveSnapshot = useCallback(
    (snapshot: SyncSnapshot) =>
      update((s) =>
        s.game?.kind === "shared" && s.game.room.code === snapshot.code
          ? {
              ...s,
              game: {
                kind: "shared",
                room: {
                  code: snapshot.code,
                  confirmed: snapshot.confirmed,
                  pending: snapshot.pending,
                  cursor: snapshot.cursor,
                },
              },
            }
          : s,
      ),
    [update],
  );
  const { sync, snapshot } = useRoomSync(room, saveSnapshot);

  const entries = useMemo(() => {
    if (game?.kind === "local") return game.entries;
    if (snapshot) return snapshot.entries;
    return room ? [...room.confirmed, ...room.pending] : NO_ENTRIES;
  }, [game, snapshot, room]);
  const board = useMemo(() => replay(entries), [entries]);
  const owned = useMemo(() => new Set(state.settings.owned), [state.settings.owned]);
  const current: Tab = tab ?? (game ? "board" : "setup");
  const device = state.settings.device;
  const shared = game?.kind === "shared";

  useWakeLock(loaded && state.settings.keepAwake && current === "board");
  const wakeLockSupported = useWakeLockSupported();

  // A finished game goes into the history; undoing the ending takes it out again.
  useEffect(() => {
    if (!board) return;
    const record = historyEntry(board, shared);
    update((s) => {
      const history = withGame(s.history, board.id, record);
      return history === s.history ? s : { ...s, history };
    });
  }, [board, shared, update]);

  const dispatch = useCallback(
    (action: Action) => {
      const entry = makeEntry(action, device);
      if (sync) {
        sync.add(entry);
        return;
      }
      update((s) => {
        if (s.game?.kind === "local") return { ...s, game: { kind: "local", entries: [...s.game.entries, entry] } };
        // A shared game whose sync hasn't started yet: it picks the tap up from here when it does.
        if (s.game?.kind === "shared") {
          return { ...s, game: { kind: "shared", room: { ...s.game.room, pending: [...s.game.room.pending, entry] } } };
        }
        return s;
      });
    },
    [device, sync, update],
  );

  const start = (setup: Extract<Action, { type: "setup" }>) => {
    const entry = makeEntry(setup, device);
    update((s) => ({
      ...s,
      game: { kind: "local", entries: [entry] },
      settings: { ...s.settings, names: setup.players.map((player) => player.name) },
    }));
    setRematch(null);
    setTab("board");
  };

  /** Puts the local game in a new room. Returns why it failed, or null. */
  const share = async (): Promise<string | null> => {
    if (game?.kind !== "local") return null;
    const uploaded = game.entries;
    try {
      const { code, cursor } = await httpTransport().create(uploaded);
      update((s) => {
        if (s.game?.kind !== "local") return s;
        // Taps made while the room was being set up go out as the first changes.
        const later = s.game.entries.slice(uploaded.length);
        return { ...s, game: { kind: "shared", room: { code, confirmed: uploaded, pending: later, cursor } } };
      });
      return null;
    } catch (err) {
      return err instanceof SyncError && err.kind === "offline"
        ? "Couldn't reach the server. Check the connection and try again."
        : "Sharing didn't work this time. Try again in a moment.";
    }
  };

  const leave = () =>
    update((s) => (s.game?.kind === "shared" ? { ...s, game: { kind: "local", entries: [...entries] } } : s));

  const join = (code: string) => {
    if (room?.code !== code) {
      update((s) => ({ ...s, game: { kind: "shared", room: { code, confirmed: [], pending: [], cursor: 0 } } }));
    }
    setTab("board");
  };

  const clearLink = () => router.replace(pathname, { scroll: false });

  if (!loaded) return <Notice>Loading…</Notice>;

  const status = snapshot?.status ?? null;
  const offerLink = linked && linked !== room?.code ? linked : null;

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Tracker sections"
        className="-mx-6 flex overflow-x-auto border-y border-edge px-6 md:mx-0 md:border-x md:px-0"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-current={current === t.id ? "page" : undefined}
            className={`min-h-11 shrink-0 flex-1 border-b-2 px-4 font-mono text-xs uppercase tracking-[0.15em] transition-colors ${
              current === t.id ? "border-accent text-accent" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "history" && state.history.length ? (
              <span className="ml-1 text-muted">{state.history.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      {offerLink ? (
        <section className="flex flex-col gap-3 border border-accent bg-card p-4">
          <p className="font-mono text-sm text-ink">
            Join shared game <span className="tracking-[0.2em]">{offerLink}</span>?
            {game ? " The game on this phone will be replaced." : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="primary"
              onClick={() => {
                join(offerLink);
                clearLink();
              }}
            >
              Join
            </Button>
            <Button onClick={clearLink}>Not now</Button>
          </div>
        </section>
      ) : null}

      {current === "board" ? (
        board ? (
          <Board
            board={board}
            device={device}
            shared={shared}
            owned={owned}
            dispatch={dispatch}
            onNewGame={() => setTab("setup")}
            onRematch={() =>
              startRematch({
                players: board.players.map((player) => ({ name: player.name, factions: player.factions })),
                target: board.target,
                first: board.first,
                madness: board.madness !== null,
              })
            }
            toolbar={
              <div className="flex flex-col gap-3">
                {canShare || room ? (
                  <ShareBar
                    room={room?.code ?? null}
                    status={status}
                    pending={snapshot?.pending.length ?? 0}
                    onShare={share}
                    onLeave={leave}
                  />
                ) : null}
                {wakeLockSupported ? (
                  <label className="flex min-h-11 items-center gap-2 font-mono text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={state.settings.keepAwake}
                      onChange={(e) =>
                        update((s) => ({ ...s, settings: { ...s.settings, keepAwake: e.target.checked } }))
                      }
                    />
                    Keep the screen on while the board is open
                  </label>
                ) : null}
              </div>
            }
          />
        ) : room ? (
          <div className="flex flex-col gap-3">
            {status === "gone" ? (
              <Notice tone="error">There is no shared game with the code {room.code}. It may have expired.</Notice>
            ) : (
              <Notice>Joining shared game {room.code}…</Notice>
            )}
            <div>
              <Button onClick={() => update((s) => ({ ...s, game: null }))}>
                {status === "gone" ? "Back" : "Cancel"}
              </Button>
            </div>
          </div>
        ) : (
          <Notice>No game in progress. Set one up under New game.</Notice>
        )
      ) : null}

      {current === "setup" ? (
        <SetupPanel
          key={rematch?.n ?? 0}
          preset={rematch?.preset}
          owned={state.settings.owned}
          lastNames={state.settings.names}
          inProgress={Boolean(board && board.result?.kind !== "won")}
          onOwnedChange={(owned) => update((s) => ({ ...s, settings: { ...s.settings, owned } }))}
          onStart={start}
          join={canShare ? <JoinForm onJoin={join} /> : null}
        />
      ) : null}

      {current === "history" ? (
        <HistoryPanel
          history={state.history}
          onClear={() => update((s) => ({ ...s, history: [] }))}
          onRematch={startRematch}
        />
      ) : null}

      <div className="flex flex-col gap-1 font-mono text-[0.65rem] leading-relaxed text-muted">
        <p>
          Smash Up is a game by Paul Peterson, published by AEG. This tracker is fan-made and not affiliated with AEG.
          Base and faction names and numbers come from the{" "}
          <a
            href="https://smashup.fandom.com/wiki/Bases"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-accent"
          >
            Smash Up Wiki
          </a>{" "}
          (CC BY-SA).
        </p>
        <p>
          Games and history stay on this device. A shared game is kept on this site&apos;s server for two days after
          its last change, under its code, and nothing else about you is sent.
        </p>
      </div>
    </div>
  );
}
