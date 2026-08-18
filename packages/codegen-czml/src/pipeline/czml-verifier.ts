/**
 * Structural + semantic verification for a model-generated CZML document. Structural rules
 * (packet shape, document-packet-first, unique ids) are enforced via zod; semantic validity is
 * checked by handing the document to Cesium's own `CzmlDataSource` parser — the same code path
 * the browser uses to load it — so anything Cesium itself would reject is caught here, before the
 * result ever reaches the client. This module never renders anything (no `Viewer` involved): it
 * only parses the document into entities to count them and surface parse errors.
 */
import { CzmlDataSource } from "cesium";
import { z } from "zod";
import { DEFAULT_MAX_LENGTH, DEFAULT_MAX_PACKETS } from "./constants.js";

/** A single CZML packet — deliberately loose; see `verifyCzml`'s doc comment for why. */
export const czmlPacketShape = z.record(z.string(), z.unknown());

/** Structural shape for a whole CZML document: a non-empty packet array with a valid document packet and unique ids. */
export const czmlDocumentShape = z
  .array(czmlPacketShape)
  .min(1, "CZML document must contain at least one packet.")
  .superRefine((packets, ctx) => {
    const first = packets[0];
    if (typeof first?.id !== "string" || first.id !== "document") {
      ctx.addIssue({
        code: "custom",
        message: 'The first CZML packet must be the document packet ({ "id": "document", ... }).',
      });
    }

    const seenIds = new Set<string>();
    packets.forEach((packet, index) => {
      if (typeof packet.id !== "string" || packet.id.length === 0) {
        ctx.addIssue({ code: "custom", message: `Packet at index ${index} is missing a string "id".` }); // prettier-ignore
        return;
      }
      if (packet.id === "document") return;
      if (seenIds.has(packet.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate packet id "${packet.id}".` });
      }
      seenIds.add(packet.id);
    });
  });

export interface VerifyCzmlOptions {
  /** Hard cap on packet count. Defaults to {@link DEFAULT_MAX_PACKETS}. */
  maxPackets?: number;
  /** Hard cap on serialized CZML size in characters. Defaults to {@link DEFAULT_MAX_LENGTH}. */
  maxLength?: number;
}

export type VerifyCzmlResult =
  | { verified: true; entityCount: number }
  | { verified: false; violations: string[] };

/**
 * Verifies `czml` (untrusted, model-produced input) in three stages: a size cap (defense against
 * an unbounded/adversarial document), zod structural validation, then a real
 * `CzmlDataSource.load` parse to catch anything Cesium itself would reject (malformed epochs,
 * mismatched sample-array lengths, unknown property shapes, ...). Never throws — parse failures
 * are reported as a `violations` entry, exactly like a structural failure.
 */
export async function verifyCzml(
  czml: unknown,
  options: VerifyCzmlOptions = {},
): Promise<VerifyCzmlResult> {
  const maxPackets = options.maxPackets ?? DEFAULT_MAX_PACKETS;
  const maxLength = options.maxLength ?? DEFAULT_MAX_LENGTH;

  const serializedLength = JSON.stringify(czml)?.length ?? 0;
  if (serializedLength > maxLength) {
    return {
      verified: false,
      violations: [
        `CZML document exceeds the ${maxLength}-character size limit (${serializedLength} characters).`,
      ],
    };
  }

  const structural = czmlDocumentShape.safeParse(czml);
  if (!structural.success) {
    return {
      verified: false,
      violations: [...new Set(structural.error.issues.map((issue) => issue.message))],
    };
  }

  if (structural.data.length > maxPackets) {
    return {
      verified: false,
      violations: [
        `CZML document exceeds the ${maxPackets}-packet limit (${structural.data.length} packets).`,
      ],
    };
  }

  try {
    // `CzmlDataSource.load` never touches a live `Viewer` — it only parses packets into entities,
    // which works headlessly (no WebGL/DOM needed) and is safe to run server-side for verification.
    const dataSource = await CzmlDataSource.load(structural.data);
    return { verified: true, entityCount: dataSource.entities.values.length };
  } catch (err) {
    return { verified: false, violations: [err instanceof Error ? err.message : String(err)] };
  }
}
