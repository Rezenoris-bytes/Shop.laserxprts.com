import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SettingsService } from './settings.service';

/**
 * Public settings surface.
 *
 * Only what the storefront needs to render without a hardcoded value —
 * contact details an admin can change on the Settings page. Everything else
 * on SettingsService (quote defaults, secrets) stays admin-only.
 */
@Controller()
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get('settings/contact')
  contact() {
    return this.settings.publicContact();
  }
}
