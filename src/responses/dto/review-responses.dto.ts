import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() || undefined : value;

/** Approve several responses at once. */
export class ApproveResponsesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Select at least one response.' })
  @ArrayMaxSize(500)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  certIds!: string[];
}

/** Reject (or revoke) one response, optionally telling the participant why. */
export class RejectResponseDto {
  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
