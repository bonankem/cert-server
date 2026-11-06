import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from '../password.js';

export class LoginDto {
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password.' })
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
