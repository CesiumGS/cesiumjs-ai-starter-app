import { afterEach, describe, expect, it } from "vitest";
import express, { type Express } from "express";
import type { AddressInfo } from "node:net";
import { rateLimiter } from "./rate-limit.js";

/**
 * Drives the rate-limiter middleware over a **real HTTP server** with Vitest:
 * a tiny Express app mounts the limiter ahead of an `/ping` route, and requests
 * go through `fetch`. All requests come from 127.0.0.1, so they share the same
 * per-IP bucket — exactly the window the limiter enforces.
 */

interface RunningServer {
  url: string;
  close: () => Promise<void>;
}

const servers: RunningServer[] = [];

async function startServer(configure: (app: Express) => void): Promise<RunningServer> {
  const app = express();
  configure(app);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;

  const running: RunningServer = {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  servers.push(running);
  return running;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

describe("rateLimiter middleware (over HTTP)", () => {
  it("allows requests up to the limit, then returns 429", async () => {
    const rpm = 3;
    const { url } = await startServer((app) => {
      app.use(rateLimiter({ rpm }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    const statuses: number[] = [];
    for (let i = 0; i < rpm + 1; i++) {
      const res = await fetch(`${url}/ping`);
      statuses.push(res.status);
      await res.text(); // drain the body so the socket is reused
    }

    expect(statuses.slice(0, rpm)).toEqual([200, 200, 200]);
    expect(statuses[rpm]).toBe(429);
  });

  it("includes a Retry-After header and a RATE_LIMITED payload on the 429", async () => {
    const { url } = await startServer((app) => {
      app.use(rateLimiter({ rpm: 1 }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    await (await fetch(`${url}/ping`)).text(); // consume the single allowed request
    const blocked = await fetch(`${url}/ping`);

    expect(blocked.status).toBe(429);
    const retryAfter = Number(blocked.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(await blocked.json()).toMatchObject({ error: "RATE_LIMITED" });
  });

  it("lets requests through again once the window has passed", async () => {
    // A 50ms window so the test stays fast.
    const { url } = await startServer((app) => {
      app.use(rateLimiter({ rpm: 1, windowMs: 50 }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    expect((await fetch(`${url}/ping`)).status).toBe(200);
    expect((await fetch(`${url}/ping`)).status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 70));

    expect((await fetch(`${url}/ping`)).status).toBe(200);
  });

  it("without trust proxy, treats requests behind a proxy as one shared IP regardless of X-Forwarded-For", async () => {
    const rpm = 2;
    const { url } = await startServer((app) => {
      // No `app.set("trust proxy", ...)`: Express ignores X-Forwarded-For and
      // req.ip resolves to the socket's own address for every request.
      app.use(rateLimiter({ rpm }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    const statuses: number[] = [];
    for (let i = 0; i < rpm + 1; i++) {
      const res = await fetch(`${url}/ping`, {
        headers: { "X-Forwarded-For": `10.0.0.${i}` },
      });
      statuses.push(res.status);
      await res.text();
    }

    expect(statuses.slice(0, rpm)).toEqual([200, 200]);
    expect(statuses[rpm]).toBe(429);
  });

  it("with trust proxy enabled, keys the limit by the forwarded client IP instead of the proxy", async () => {
    const rpm = 1;
    const { url } = await startServer((app) => {
      app.set("trust proxy", true);
      app.use(rateLimiter({ rpm }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    const first = await fetch(`${url}/ping`, {
      headers: { "X-Forwarded-For": "10.0.0.1" },
    });
    await first.text();
    const second = await fetch(`${url}/ping`, {
      headers: { "X-Forwarded-For": "10.0.0.2" },
    });
    await second.text();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const third = await fetch(`${url}/ping`, {
      headers: { "X-Forwarded-For": "10.0.0.1" },
    });

    expect(third.status).toBe(429);
  });

  it("enforces the shared limit across concurrent requests from the same IP", async () => {
    const rpm = 5;
    const { url } = await startServer((app) => {
      app.use(rateLimiter({ rpm }));
      app.get("/ping", (_req, res) => res.json({ ok: true }));
    });

    const responses = await Promise.all(
      Array.from({ length: rpm + 3 }, () => fetch(`${url}/ping`)),
    );
    await Promise.all(responses.map((res) => res.text()));

    const allowed = responses.filter((res) => res.status === 200).length;
    const limited = responses.filter((res) => res.status === 429).length;

    expect(allowed).toBe(rpm);
    expect(limited).toBe(3);
  });
});
