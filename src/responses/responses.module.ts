import { Module } from '@nestjs/common';
import { AdminResponsesController } from './admin-responses.controller.js';
import { PublicResponsesController } from './public-responses.controller.js';
import { ResponsesService } from './responses.service.js';

@Module({
  controllers: [PublicResponsesController, AdminResponsesController],
  providers: [ResponsesService],
})
export class ResponsesModule {}
