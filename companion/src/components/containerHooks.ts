import * as app from "@/container";

/** Indirection so components read services through one place (and tests can stub it). */
export function container(): typeof app {
  return app;
}
