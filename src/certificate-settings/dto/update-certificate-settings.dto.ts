import { Transform } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';

/** ~1.1 MB image once base64-encoded. */
export const MAX_SIGNATURE_LENGTH = 1_500_000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value);

export class UpdateCertificateSettingsDto {
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  trainerName!: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must use YYYY-MM-DD format.' })
  startDate?: string;

  @IsOptional()
  @IsString()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must use YYYY-MM-DD format.' })
  endDate?: string;

  /** PNG data URL, or '' to remove the signature. */
  @IsString()
  @ValidateIf((_, value) => value !== '')
  @MaxLength(MAX_SIGNATURE_LENGTH, { message: 'Signature image is too large. Try a smaller image.' })
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/, { message: 'Signature must be a PNG image.' })
  signature!: string;
}
