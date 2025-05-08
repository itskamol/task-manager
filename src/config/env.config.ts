import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
});

export type EnvConfig = z.infer<typeof envSchema>;