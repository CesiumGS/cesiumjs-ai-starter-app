#!/usr/bin/env node
/**
 * Re-vendors the official CZML JSON Schema (`Schema/**`) from a pinned commit of
 * https://github.com/AnalyticalGraphicsInc/czml-writer into `../schema/czml`, overwriting
 * whatever is currently there. Run via `npm run sync:czml-schema` (also wired as this package's
 * `prebuild`, so `npm run build`/`build:packages`/Docker builds always regenerate it before use).
 *
 * Deliberately NOT committed to git (`schema/czml/` is gitignored) — only this script + the pinned
 * `CZML_WRITER_REF` are version-controlled, so upgrading to a newer czml-writer schema is an
 * explicit, reviewable change to that one constant, and the repo never has to carry ~60 vendored
 * JSON files as a diff. `czml-official-schema.ts`'s runtime behavior is unaffected: it still reads
 * `schema/czml/**` purely from local disk with no network access at request time — only this
 * one-off sync step needs network access, same as any other dependency install/build step.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

// Pin to a specific commit (not a branch) for reproducibility — bump deliberately, never track `main`.
const CZML_WRITER_REF = "1855e3ccc11e5c0719fa1b66e96c6a4a9b431f70";
const TARBALL_URL = `https://codeload.github.com/AnalyticalGraphicsInc/czml-writer/tar.gz/${CZML_WRITER_REF}`;
const SCHEMA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../schema/czml");

/** Reads a NUL-terminated (or NUL-padded) fixed-width ASCII field out of a tar header block. */
function readTarField(header, start, length) {
  const slice = header.subarray(start, start + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? length : nul).toString("utf8");
}

/**
 * Minimal ustar reader: only extracts regular files (typeflag "0"/"\0"), skipping pax extended
 * header entries ("g"/"x") — czml-writer's Schema/ paths are short enough to never need those.
 */
function extractTarEntries(tarBuffer) {
  const entries = [];
  let offset = 0;
  while (offset + 512 <= tarBuffer.length) {
    const header = tarBuffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break; // end-of-archive marker
    const name = readTarField(header, 0, 100);
    const prefix = readTarField(header, 345, 155);
    const sizeText = readTarField(header, 124, 12).trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const typeflag = String.fromCharCode(header[156] || 0);
    offset += 512;
    const content = tarBuffer.subarray(offset, offset + size);
    if (typeflag === "0" || typeflag === "\0") {
      entries.push({ name: prefix ? `${prefix}/${name}` : name, content });
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function main() {
  console.log(`Fetching czml-writer's Schema/ @ ${CZML_WRITER_REF}...`);
  const response = await fetch(TARBALL_URL);
  if (!response.ok) {
    throw new Error(
      `Failed to download czml-writer tarball: ${response.status} ${response.statusText}`,
    );
  }
  const tarBuffer = gunzipSync(Buffer.from(await response.arrayBuffer()));
  const entries = extractTarEntries(tarBuffer);

  // Entries look like "czml-writer-<sha>/Schema/Document.json" — strip the repo/ref-specific prefix.
  const schemaEntries = entries
    .map((entry) => ({ ...entry, relativePath: entry.name.replace(/^[^/]+\/Schema\//, "") }))
    .filter((entry) => entry.relativePath !== entry.name && entry.relativePath.length > 0);

  if (schemaEntries.length === 0) {
    throw new Error(
      "No files found under Schema/ in the downloaded tarball — has czml-writer's layout changed?",
    );
  }

  await rm(SCHEMA_DIR, { recursive: true, force: true });
  for (const entry of schemaEntries) {
    const destPath = path.join(SCHEMA_DIR, entry.relativePath);
    await mkdir(path.dirname(destPath), { recursive: true });
    await writeFile(destPath, entry.content);
  }
  console.log(`Synced ${schemaEntries.length} files from czml-writer's Schema/ into schema/czml/.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
