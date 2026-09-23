/// <reference lib="webworker" />
import { type OptimizeInput, optimize } from "./optimize";

/** Runs one shard of the search off the main thread, streaming partial results. */
self.onmessage = (event: MessageEvent<OptimizeInput>) => {
  try {
    const result = optimize(event.data, (partial) => {
      if (!partial.progress.done) self.postMessage({ type: "update", result: partial });
    });
    self.postMessage({ type: "done", result });
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) });
  }
};
