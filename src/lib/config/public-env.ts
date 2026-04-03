import { z } from "zod";

const publicRuntimeEnvSchema = z.object({
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid URL").optional(),
});

export interface PublicRuntimeEnv {
  walletConnectProjectId: string | null;
  appUrl: string | null;
  isValid: boolean;
  errors: string[];
}

let cached: PublicRuntimeEnv | null = null;

export function getPublicRuntimeEnv(): PublicRuntimeEnv {
  if (cached) {
    return cached;
  }

  const parsed = publicRuntimeEnvSchema.safeParse({
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });

  if (parsed.success) {
    cached = {
      walletConnectProjectId: parsed.data.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? null,
      appUrl: parsed.data.NEXT_PUBLIC_APP_URL ?? null,
      isValid: true,
      errors: [],
    };

    return cached;
  }

  cached = {
    walletConnectProjectId: null,
    appUrl: null,
    isValid: false,
    errors: parsed.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };

  return cached;
}
