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
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
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
import { FilesService } from '../files/files.service';
import { EnquiriesService } from './enquiries.service';

@Controller()
export class EnquiriesController {
  constructor(
    private readonly enquiries: EnquiriesService,
    private readonly files: FilesService,
  ) {}

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

  /**
   * Public photo upload for enquiries (§24, Phase C).
   *
   * Uploaded BEFORE the form is submitted, returning ids the submission then
   * references. Two reasons: a photo on workshop 4G takes far longer than the
   * rest of the form, and decoupling it means a failed upload costs the photo
   * rather than the whole enquiry.
   *
   * The bytes are validated by decoding them (FilesService), so this cannot be
   * used to park arbitrary files on the server. Stored private — a customer's
   * workshop photo is not catalogue artwork.
   */
  @Public()
  @Post('enquiries/attachments')
  @HttpCode(HttpStatus.CREATED)
  async uploadAttachment(@Req() request: FastifyRequest) {
    if (!request.isMultipart()) {
      throw new BadRequestException('Expected a multipart/form-data upload');
    }

    const stored: Array<{ fileId: number; name: string }> = [];
    try {
      for await (const part of request.files()) {
        // Capped low on purpose: this is an identification photo, and the cap
        // is the only thing standing between a public endpoint and disk fill.
        if (stored.length >= 8) break;
        const file = await this.files.storeEnquiryPhoto(await part.toBuffer(), part.filename);
        stored.push({ fileId: file.id, name: part.filename });
      }
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }

    if (stored.length === 0) throw new BadRequestException('No photo was uploaded');
    return { files: stored };
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
