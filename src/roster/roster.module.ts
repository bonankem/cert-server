import { Module } from '@nestjs/common';
import { RosterService } from './roster.service.js';

/** The participant list. Its admin controller lives in ResponsesModule, because adding entries also approves matching submissions. */
@Module({
  providers: [RosterService],
  exports: [RosterService],
})
export class RosterModule {}
