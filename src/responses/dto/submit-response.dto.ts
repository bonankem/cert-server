import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';
import { OPCOS, QUESTIONS } from '../../form-config/form-config.js';
import { Consent } from '../../generated/prisma/client.js';
import type { AnswerMap } from '../responses.types.js';

const collapseWhitespace = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : value;

/** Every question answered with one of its options, and nothing else. */
function IsCompleteAnswerSet(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isCompleteAnswerSet',
      target: target.constructor,
      propertyName,
      options: { message: 'Answer every question with one of its options.', ...options },
      validator: {
        validate(value: unknown) {
          if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
          const answers = value as Record<string, unknown>;
          const knownIds = new Set(QUESTIONS.map((q) => q.id));
          return (
            Object.keys(answers).every((id) => knownIds.has(id)) &&
            QUESTIONS.every((q) => typeof answers[q.id] === 'string' && q.options.includes(answers[q.id] as string))
          );
        },
      },
    });
}

export class SubmitResponseDto {
  @Transform(collapseWhitespace)
  @IsString()
  @MinLength(4, { message: 'Enter your first name and surname.' })
  @MaxLength(120)
  @Matches(/^\S+(\s\S+)+$/, { message: 'Enter your first name and surname.' })
  fullName!: string;

  @IsIn(OPCOS, { message: 'Choose your OpCo from the list.' })
  opco!: string;

  @IsEnum(Consent, { message: 'Choose yes or no.' })
  consent!: Consent;

  @IsObject()
  @IsCompleteAnswerSet()
  answers!: AnswerMap;
}
