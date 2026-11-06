import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { toAuthUser, UsersService } from '../users/users.service.js';
import type { AuthUser, SessionMeta } from './auth.types.js';
import type { ChangePasswordDto } from './dto/change-password.dto.js';
import type { LoginDto } from './dto/login.dto.js';
import { hashPassword, verifyPassword } from './password.js';
import { SessionsService } from './sessions.service.js';

const INVALID_CREDENTIALS = 'Incorrect email or password.';

@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so timing doesn't reveal which accounts exist. */
  private readonly dummyHash = hashPassword('timing-equaliser-not-a-real-password');

  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
  ) {}

  async login(dto: LoginDto, meta: SessionMeta): Promise<{ user: AuthUser; token: string; expiresAt: Date }> {
    const user = await this.users.findByEmail(dto.email);
    const valid = await verifyPassword(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const [{ token, expiresAt }, updated] = await Promise.all([
      this.sessions.create(user.id, meta),
      this.users.markLoggedIn(user.id),
    ]);
    return { user: toAuthUser(updated), token, expiresAt };
  }

  logout(token: string): Promise<void> {
    return this.sessions.revoke(token);
  }

  /** Change password and sign out every other session. */
  async changePassword(userId: string, currentToken: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user || !(await verifyPassword(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('Choose a password you haven’t used here.');
    }
    await this.users.updatePasswordHash(userId, await hashPassword(dto.newPassword));
    await this.sessions.revokeAllForUser(userId, currentToken);
  }
}
