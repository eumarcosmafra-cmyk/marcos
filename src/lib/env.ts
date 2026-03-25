import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().optional().default(""),
  SERP_API_KEY: z.string().optional().default(""),
  SERP_API_PROVIDER: z.string().optional().default("serper"),
  CRON_SECRET: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function getEnv(): Env {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}

export function hasSerpApi(): boolean {
  return getEnv().SERP_API_KEY.length > 0;
}

export function hasDatabase(): boolean {
  const url = process.env.DATABASE_URL || "";
  return url.length > 0 && !url.includes("johndoe");
}
