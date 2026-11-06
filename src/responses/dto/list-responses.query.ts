import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { OPCOS } from '../../form-config/form-config.js';
import { Consent } from '../../generated/prisma/client.js';

export const SORT_FIELDS = ['submittedAt', 'name', 'participantDownloads', 'lastDownloadedAt'] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export const SORT_ORDERS = ['ascend', 'descend'] as const;
export const DOWNLOAD_STATUSES = ['downloaded', 'pending'] as const;
export const PAGE_SIZES = [10, 20, 50, 100] as const;

const toArray = ({ value }: { value: unknown }) =>
  value === undefined || value === '' ? undefined : Array.isArray(value) ? value : [value];

/** Filters shared by the list and the CSV export. */
export class ResponseFiltersQuery {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(OPCOS, { each: true })
  opco?: string[];

  @IsOptional()
  @IsEnum(Consent)
  consent?: Consent;

  @IsOptional()
  @IsIn(DOWNLOAD_STATUSES)
  status?: (typeof DOWNLOAD_STATUSES)[number];
}

export class ListResponsesQuery extends ResponseFiltersQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsIn(PAGE_SIZES)
  pageSize: (typeof PAGE_SIZES)[number] = 20;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sortField: SortField = 'submittedAt';

  @IsOptional()
  @IsIn(SORT_ORDERS)
  sortOrder: (typeof SORT_ORDERS)[number] = 'descend';
}

export class VerifyQuery {
  @IsString()
  @MaxLength(40)
  q!: string;
}
