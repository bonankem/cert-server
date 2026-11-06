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

  @Transform(toBoolean)
  @IsBoolean()
  TRUST_PROXY = false;

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
