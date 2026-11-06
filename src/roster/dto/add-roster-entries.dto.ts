import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class RosterEntryInput {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'One of the email addresses is not valid.' })
  @MaxLength(254)
  email?: string;
}

export class AddRosterEntriesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Add at least one participant.' })
  @ArrayMaxSize(2000, { message: 'Add at most 2,000 participants at a time.' })
  @ValidateNested({ each: true })
  @Type(() => RosterEntryInput)
  entries!: RosterEntryInput[];
}
