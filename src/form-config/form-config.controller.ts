import { Controller, Get, Header } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';
import { FORM_CONFIG, type FormConfig } from './form-config.js';

@Controller('form-config')
export class FormConfigController {
  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=300')
  get(): FormConfig {
    return FORM_CONFIG;
  }
}
