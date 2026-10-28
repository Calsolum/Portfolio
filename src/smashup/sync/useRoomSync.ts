"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { RoomSync, httpTransport, type SavedRoom, type SyncSnapshot } from "./client";

const noSubscribe = () => () => {};
const noSnapshot = () => null;

/**
 * Keeps a shared game in step while it is open, and hands back each change so
 * it can be saved. A new RoomSync starts only when the room code changes; it
 * picks up from what was saved, so a reload rejoins without reading everything
 * again.
 */
export function useRoomSync(room: SavedRoom | null, onChange: (snapshot: SyncSnapshot) => void) {
  const [sync, setSync] = useState<RoomSync | null>(null);
  const saved = useRef(room);
  const save = useRef(onChange);
  useEffect(() => {
    saved.current = room;
    save.current = onChange;
  });

  const code = room?.code ?? null;
  useEffect(() => {
    if (!code) return;
    const start = saved.current;
    const next = new RoomSync(code, httpTransport(), start?.code === code ? start : undefined);
    setSync(next);
    next.setVisible(document.visibilityState === "visible");
    next.start();
    const onVisibility = () => next.setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      next.stop();
      setSync(null);
    };
  }, [code]);

  const live = sync && sync.code === code ? sync : null;
  const snapshot = useSyncExternalStore(
    live?.subscribe ?? noSubscribe,
    live?.getSnapshot ?? noSnapshot,
    noSnapshot,
  );

  useEffect(() => {
    if (snapshot) save.current(snapshot);
  }, [snapshot]);

  return { sync: live, snapshot };
}
