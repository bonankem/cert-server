import { plainToInstance, Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const toBoolean = ({ value }: { value: unknown }) => value === true || value === 'true';

/** Every environment variable the server reads, validated at boot. */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @Transform(({ value }) => Number(value))
  @IsPositive()
  SESSION_TTL_HOURS = 12;

  @Transform(toBoolean)
  @IsBoolean()
  COOKIE_SECURE = false;

  /**
   * How many reverse-proxy hops sit in front of the app, so req.ip is the real
   * client. 0/false = none, true = 1. Behind Vercel → Render, use 2.
   */
  @Transform(({ value }: { value: unknown }) => {
    if (value === true || value === 'true') return 1;
    if (value === false || value === 'false' || value === undefined || value === '') return 0;
    return Number(value);
  })
  @IsInt()
  @Min(0)
  @Max(10)
  TRUST_PROXY = 0;

  @IsOptional()
  @IsUrl({ require_tld: false })
  CORS_ORIGIN?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length) {
    const details = errors.map((e) => `  ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`);
    throw new Error(`Invalid environment configuration:\n${details.join('\n')}`);
  }
  return env;
}
