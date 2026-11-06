import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AddRosterEntriesDto } from '../roster/dto/add-roster-entries.dto.js';
import { RosterService, type RosterEntryView } from '../roster/roster.service.js';
import { ResponsesService } from './responses.service.js';

/**
 * The participant list used for automatic approval (admin only). Adding people
 * also approves any pending submissions that now match.
 */
@Controller('admin/roster')
export class AdminRosterController {
  constructor(
    private readonly roster: RosterService,
    private readonly responses: ResponsesService,
  ) {}

  @Get()
  list(): Promise<RosterEntryView[]> {
    return this.roster.list();
  }

  @Post()
  async add(
    @Body() { entries }: AddRosterEntriesDto,
    @CurrentUser() user: AuthUser,
  ): Promise<{ added: number; skipped: number; approved: number }> {
    const result = await this.roster.add(entries, user.id);
    const { updated } = await this.responses.approveRosterMatches();
    return { ...result, approved: updated };
  }

  @Delete()
  async clear(): Promise<{ removed: number }> {
    return { removed: await this.roster.clear() };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.roster.remove(id);
  }
}
