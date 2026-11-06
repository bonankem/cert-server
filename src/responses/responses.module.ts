import { Module } from '@nestjs/common';
import { RosterModule } from '../roster/roster.module.js';
import { AdminResponsesController } from './admin-responses.controller.js';
import { AdminRosterController } from './admin-roster.controller.js';
import { PublicResponsesController } from './public-responses.controller.js';
import { ResponsesService } from './responses.service.js';

@Module({
  imports: [RosterModule],
  controllers: [PublicResponsesController, AdminResponsesController, AdminRosterController],
  providers: [ResponsesService],
})
export class ResponsesModule {}
