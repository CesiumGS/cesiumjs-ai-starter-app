import { CzmlDataSource, type Viewer } from "cesium";
import { generateCzmlResultShape } from "./generate-czml-result";

export {
  generateCzmlResultShape,
  isGenerateCzmlTool,
  type GenerateCzmlResult,
} from "./generate-czml-result";

/** The real, client-confirmed outcome of loading an already-verified CZML document. */
export type GenerateCzmlLoadOutcome =
  { success: true; entityCount: number } | { success: false; error: string };

/**
 * Loads an already-verified CZML document into the live `Viewer` via `CzmlDataSource`. The
 * document already passed the backend's `verifyCzml` (structural + a headless `CzmlDataSource`
 * parse) — this is the step only the browser can perform: actually adding it to the live scene.
 */
export async function loadGeneratedCzml(
  viewer: Viewer,
  czml: Record<string, unknown>[],
): Promise<GenerateCzmlLoadOutcome> {
  try {
    const dataSource = await CzmlDataSource.load(czml);
    await viewer.dataSources.add(dataSource);
    // `automaticallyTrackDataSourceClocks` (on by default) copies the document clock packet's
    // startTime/stopTime/currentTime/multiplier onto `viewer.clock`, but `DataSourceClock.getValue`
    // never touches `shouldAnimate` — so a time-dynamic document loads correctly configured but
    // paused until the user manually presses the Animation widget's play button. Start it
    // automatically since a generated animation is expected to play immediately.
    if (dataSource.clock) {
      viewer.clock.shouldAnimate = true;
    }
    return { success: true, entityCount: dataSource.entities.values.length };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Validates a server-resolved `generateCzml` tool result and, if it carries a verified document,
 * loads it against the live `Viewer`. `output` is server-influenced but still untrusted
 * client-side input, so it's parsed against `generateCzmlResultShape` before anything touches
 * the Viewer.
 */
export async function handleGenerateCzmlResult(
  viewer: Viewer | null,
  output: unknown,
): Promise<GenerateCzmlLoadOutcome> {
  const parsed = generateCzmlResultShape.safeParse(output);
  if (!parsed.success) {
    return { success: false, error: "Malformed generateCzml result." };
  }
  if ("error" in parsed.data) {
    return { success: false, error: parsed.data.error };
  }
  if (!viewer) {
    return { success: false, error: "CesiumJS Viewer is not initialised" };
  }

  return loadGeneratedCzml(viewer, parsed.data.czml);
}
