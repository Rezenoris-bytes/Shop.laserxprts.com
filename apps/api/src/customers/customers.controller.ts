import { Body, Controller, Get, Param, ParseIntPipe, Patch, Query } from '@nestjs/common';
import {


  adminListQuerySchema,
  type AdminListQuery,
} from '@lei/shared';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ZodQuery } from '../common/pipes/zod-validation.pipe';
import { CustomersService } from './customers.service';

/**
 * Customers carry PII. This route requires CUSTOMERS permission specifically —
 * a Catalogue admin's default template does not grant it, so a CATALOGUE admin
 * gets 403 here by design.
 */
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()

  async list(@Query(ZodQuery(adminListQuerySchema)) query: AdminListQuery) {
    const { items, total } = await this.service.list({
      skip: (query.page - 1) * query.perPage,
      take: query.perPage,
      q: query.q,
    });
    const totalPages = Math.max(1, Math.ceil(total / query.perPage));
    return {
      data: items,
      meta: {
        pagination: {
          page: query.page,
          perPage: query.perPage,
          total,
          totalPages,
          hasNext: query.page < totalPages,
          hasPrev: query.page > 1,
        },
      },
    };
  }

  @Get(':id')

  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Patch(':id')

  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
    @CurrentUser('id') actorId: number,
  ) {
    return this.service.update(id, body, actorId);
  }
}
