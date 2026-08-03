import type { Viewer } from "cesium";

/**
 * Tracks which `viewer.entities` ids were created via `animationCreate`, keyed
 * per-`Viewer` (a `WeakMap` so nothing leaks once a `Viewer` is destroyed).
 * `animationControl`/`animationRemove`/`animationUpdatePath`/
 * `animationCameraTracking`/`animationListActive` only ever act on ids this
 * package itself registered — not arbitrary app entities that happen to share
 * the same `viewer.entities` collection — so a plain unrelated entity can
 * never accidentally be treated as an "animation".
 */
const animationIdsByViewer = new WeakMap<Viewer, Set<string>>();

export function registerAnimation(viewer: Viewer, animationId: string): void {
  getAnimationIds(viewer).add(animationId);
}

export function unregisterAnimation(viewer: Viewer, animationId: string): void {
  getAnimationIds(viewer).delete(animationId);
}

export function isKnownAnimation(viewer: Viewer, animationId: string): boolean {
  return getAnimationIds(viewer).has(animationId);
}

export function listAnimationIds(viewer: Viewer): string[] {
  return [...getAnimationIds(viewer)];
}

function getAnimationIds(viewer: Viewer): Set<string> {
  let ids = animationIdsByViewer.get(viewer);
  if (!ids) {
    ids = new Set();
    animationIdsByViewer.set(viewer, ids);
  }
  return ids;
}
