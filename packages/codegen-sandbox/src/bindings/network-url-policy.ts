import { HANDLE_MARK } from "./sandbox-handles.js";

export interface NetworkUrlPolicy {
  allowedOrigins: ReadonlySet<string>;
  allowRelativeUrls: boolean;
}

export function createNetworkUrlPolicy(
  allowedOrigins: readonly string[] = [],
  allowRelativeUrls = false,
): NetworkUrlPolicy {
  return {
    allowedOrigins: new Set(
      allowedOrigins.map((origin) => {
        const parsed = new URL(origin);
        if (parsed.origin === "null") throw new Error(`Invalid network origin "${origin}"`);
        return parsed.origin;
      }),
    ),
    allowRelativeUrls,
  };
}

export function assertNetworkUrlsAllowed(value: unknown, policy: NetworkUrlPolicy): void {
  if (typeof value === "string") {
    const candidate = value.trim();
    if (candidate.startsWith("//")) {
      throw new Error(
        `Cesium sandbox protocol-relative network URL "${candidate}" is not allowed; use an explicit HTTP(S) scheme.`,
      );
    }
    if (/^https?:\/\//i.test(candidate)) {
      const origin = new URL(candidate).origin;
      if (!policy.allowedOrigins.has(origin)) {
        throw new Error(`Cesium sandbox network access to origin "${origin}" is not allowed.`);
      }
    } else if (
      !policy.allowRelativeUrls &&
      (candidate.startsWith("/") || candidate.startsWith("./") || candidate.startsWith("../"))
    ) {
      throw new Error(`Cesium sandbox relative network URL "${candidate}" is not allowed.`);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) assertNetworkUrlsAllowed(item, policy);
    return;
  }

  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (HANDLE_MARK in record) return;
    for (const item of Object.values(record)) assertNetworkUrlsAllowed(item, policy);
  }
}
