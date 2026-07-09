import { createBackendApp } from "./app.js";
import { env } from "./utils/env.js";
import { createModel, createProviderConfig, isProviderConfigured } from "./utils/providers.js";

const provider = createProviderConfig(env);
const model =
  env.CHAT_ENABLED && isProviderConfigured(provider) ? await createModel(provider) : undefined;

const app = createBackendApp({ env, model });

const url = new URL(env.PUBLIC_URL);
const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;

app.listen(port, () => {
  console.log(`Backend listening on ${env.PUBLIC_URL}`);
  console.log(
    `  chat: ${env.CHAT_ENABLED ? "enabled" : "disabled"} | provider: ${env.AI_PROVIDER} | rate limit: ${env.RATE_LIMIT_RPM} rpm`,
  );
});
