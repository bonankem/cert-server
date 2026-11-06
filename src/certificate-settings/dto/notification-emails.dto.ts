import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsEmail, MaxLength } from 'class-validator';

const normalizeList = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v)).filter((v) => v !== '')
    : value;

/** Admin addresses told about new submissions and update requests. An empty list turns them off. */
export class NotificationEmailsDto {
  @Transform(normalizeList)
  @IsArray()
  @ArrayMaxSize(20, { message: 'Add at most 20 addresses.' })
  @ArrayUnique({ message: 'Each address can only be added once.' })
  @IsEmail({}, { each: true, message: 'One of the addresses is not a valid email.' })
  @MaxLength(254, { each: true })
  emails!: string[];
}
