import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {


  adminListQuerySchema,
  quoteRequestSchema,
  contactFormSchema,
  updateEnquirySchema,
  type AdminListQuery,
  type QuoteRequestInput,
  type ContactFormInput,
  type UpdateEnquiryInput,
} from '@lei/shared';
import { Public } from '../common/decorators/public.decorator';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Client, type ClientContext } from '../common/decorators/client-context.decorator';
import { ZodBody, ZodQuery } from '../common/pipes/zod-validation.pipe';
import type { AuthenticatedUser } from '../auth/auth.service';
import { EnquiriesService } from './enquiries.service';

@Controller()
export class EnquiriesController {
  constructor(private readonly enquiries: EnquiriesService) {}

  /**
   * Public Quote Request submission — the primary conversion path.
   *
   * Rate limiting is applied at the guard level; the honeypot and timing checks
   * live in the service so a bot receives a plausible success rather than
   * learning it was detected.
   */
  @Public()
  @Post('enquiries')
  @HttpCode(HttpStatus.CREATED)
  async submit(
    @Body(ZodBody(quoteRequestSchema)) body: QuoteRequestInput,
    @Client() client: ClientContext,
  ) {
    const result = await this.enquiries.submit(body, client);
    return {
      publicRef: result.publicRef,
      itemCount: result.itemCount,
      message: 'Your request has been received. We will respond within one working day.',
    };
  }

  @Public()
  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  async submitContact(
    @Body(ZodBody(contactFormSchema)) body: ContactFormInput,
    @Client() client: ClientContext,
  ) {
    const result = await this.enquiries.submitContact(body, client);
    return {
      publicRef: result.publicRef,
      message: 'Your message has been received. We will respond within one working day.',
    };
  }

  @Get('admin/enquiries')

  list(@Query(ZodQuery(adminListQuerySchema)) query: AdminListQuery) {
    return this.enquiries.list({
      page: query.page,
      perPage: query.perPage,
      status: query.status,
      search: query.q,
    });
  }

  @Get('admin/enquiries/:id')

  get(@Param('id', ParseIntPipe) id: number) {
    return this.enquiries.get(id);
  }

  @Patch('admin/enquiries/:id')

  update(
    @Param('id', ParseIntPipe) id: number,
    @Body(ZodBody(updateEnquirySchema)) body: UpdateEnquiryInput,
    @CurrentUser() user: AuthenticatedUser,
    @Client() client: ClientContext,
  ) {
    return this.enquiries.update(id, body, user.id, client);
  }
}
