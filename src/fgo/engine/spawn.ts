/** Kept beside the worker so the bundler resolves the entry with a same-folder URL. */
export function spawnOptimizer(): Worker {
  return new Worker(new URL("./optimizer.worker.ts", import.meta.url), { type: "module" });
}
