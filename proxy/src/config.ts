export interface ProxyConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  port: number;
  rateLimitPerMinute: number;
}

/** Reads and validates configuration from the environment. Called once at startup, never per-request. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ProxyConfig {
  return {
    clientId: requireEnv(env, "ATLASSIAN_CLIENT_ID"),
    clientSecret: requireEnv(env, "ATLASSIAN_CLIENT_SECRET"),
    redirectUri: requireEnv(env, "ATLASSIAN_REDIRECT_URI"),
    port: Number(env.PORT ?? 8787),
    rateLimitPerMinute: Number(env.RATE_LIMIT_PER_MINUTE ?? 30),
  };
}

function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}
