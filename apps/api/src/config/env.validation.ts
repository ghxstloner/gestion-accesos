import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { plainToInstance } from 'class-transformer';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Sentinel secrets that must never be used outside development. The startup
 * validator rejects them when NODE_ENV=production so a misconfigured deploy
 * cannot sign real JWTs with a publicly-known key.
 */
export const FORBIDDEN_PROD_SECRETS = new Set<string>([
  'dev-access-secret-not-for-production-use',
  'dev-refresh-secret-not-for-production-use',
  'change-me',
  'secret',
  'changeme',
  'dev-secret',
  'test-secret',
]);

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number = 4000;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  DATABASE_URL_TEST: string;

  /**
   * JWT secrets. In production they MUST be at least 32 characters long and
   * MUST NOT match any of the development sentinels listed in
   * FORBIDDEN_PROD_SECRETS.
   */
  @IsString()
  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV === NodeEnv.Production, {
    message:
      'JWT_ACCESS_SECRET is required in production (NODE_ENV=production)',
  })
  JWT_ACCESS_SECRET: string;

  @IsString()
  @ValidateIf((o: EnvironmentVariables) => o.NODE_ENV === NodeEnv.Production, {
    message:
      'JWT_REFRESH_SECRET is required in production (NODE_ENV=production)',
  })
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_ACCESS_TTL: string;

  @IsString()
  JWT_REFRESH_TTL: string;

  @IsString()
  CORS_ORIGINS: string;

  @IsString()
  COOKIE_DOMAIN: string;

  @IsString()
  STORAGE_PATH: string;

  @IsNumber()
  @Min(1)
  MAX_FILE_SIZE: number;

  // ── Rate-limit configuration (env-overridable defaults). ──

  /** Short window TTL in milliseconds (default 1s, used for login brute-force). */
  @IsNumber()
  @Min(100)
  @IsOptional()
  THROTTLE_SHORT_TTL: number = 1000;

  /** Max requests in the short window (default 3). */
  @IsNumber()
  @Min(1)
  @IsOptional()
  THROTTLE_SHORT_LIMIT: number = 3;

  /** Medium window TTL in milliseconds (default 10s, used for write ops). */
  @IsNumber()
  @Min(100)
  @IsOptional()
  THROTTLE_MEDIUM_TTL: number = 10_000;

  /** Max requests in the medium window (default 20). */
  @IsNumber()
  @Min(1)
  @IsOptional()
  THROTTLE_MEDIUM_LIMIT: number = 20;

  /** Long window TTL in milliseconds (default 60s, used for general traffic). */
  @IsNumber()
  @Min(100)
  @IsOptional()
  THROTTLE_LONG_TTL: number = 60_000;

  /** Max requests in the long window (default 100). */
  @IsNumber()
  @Min(1)
  @IsOptional()
  THROTTLE_LONG_LIMIT: number = 100;
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  assertProductionSecretSafety(validated);
  return validated;
}

/**
 * Hard-rejects startup when a development JWT secret is used in production or
 * when the secret is shorter than 32 characters. The error lists the offending
 * variable name only — never its value — to avoid leaking secrets in logs.
 */
function assertProductionSecretSafety(env: EnvironmentVariables): void {
  if (env.NODE_ENV !== NodeEnv.Production) return;
  const checks: Array<{ name: string; value?: string }> = [
    { name: 'JWT_ACCESS_SECRET', value: env.JWT_ACCESS_SECRET },
    { name: 'JWT_REFRESH_SECRET', value: env.JWT_REFRESH_SECRET },
  ];
  for (const { name, value } of checks) {
    if (!value) {
      throw new Error(`${name} must be set when NODE_ENV=production`);
    }
    if (value.length < 32) {
      throw new Error(
        `${name} must be at least 32 characters long when NODE_ENV=production`,
      );
    }
    if (FORBIDDEN_PROD_SECRETS.has(value)) {
      throw new Error(
        `${name} matches a known development secret and cannot be used in production`,
      );
    }
  }
}
