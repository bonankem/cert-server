import { Module } from '@nestjs/common';
import { FormConfigController } from './form-config.controller.js';

@Module({
  controllers: [FormConfigController],
})
export class FormConfigModule {}
