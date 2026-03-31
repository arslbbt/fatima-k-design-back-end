import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role, PaymentStatus } from '@prisma/client';

@ApiTags('Payments Management')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Roles(Role.ADMIN)
  @Post()
  @ApiOperation({ summary: 'Admin — Create a new payment request' })
  create(@Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(dto);
  }

  @Roles(Role.ADMIN)
  @Get('admin')
  @ApiOperation({ summary: 'Admin — List all payments with pagination' })
  listAdminPayments(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.getAdminPayments({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      status,
    });
  }

  @Roles(Role.ADMIN)
  @Get('revenue-overview')
  @ApiOperation({ summary: 'Admin — Get revenue dashboard summary' })
  getRevenueOverview() {
    return this.paymentsService.getRevenueOverview();
  }

  @Roles(Role.ADMIN)
  @Get('monthly-revenue')
  @ApiOperation({ summary: 'Admin — Get monthly revenue for graph' })
  getMonthlyRevenue(@Query('year') year?: string) {
    return this.paymentsService.getMonthlyRevenue(
      year ? parseInt(year) : undefined,
    );
  }

  @Roles(Role.ADMIN)
  @Patch(':id/mark-paid')
  @ApiOperation({ summary: 'Admin — Mark a payment as paid' })
  markAsPaid(@Param('id') id: string) {
    return this.paymentsService.markAsPaid(id);
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  @ApiOperation({
    summary: 'Admin — Update payment amount, due date or notes (unpaid only)',
  })
  update(
    @Param('id') id: string,
    @Body() body: { amount?: number; dueDate?: string; notes?: string },
  ) {
    return this.paymentsService.updatePayment(id, body);
  }

  @Roles(Role.ADMIN)
  @Get('brides-tracking')
  @ApiOperation({
    summary: 'Admin — List brides with payment summaries (paginated)',
  })
  getBridesTracking(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.paymentsService.getBridesPaymentTracking({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      status,
    });
  }

  @Roles(Role.ADMIN)
  @Get('brides-tracking/all')
  @ApiOperation({
    summary: 'Admin — Get all brides tracking for overview cards (unpaginated)',
  })
  getAllBridesTracking() {
    return this.paymentsService.getAllBridesTracking();
  }

  @Roles(Role.ADMIN)
  @Post(':id/remind')
  @ApiOperation({ summary: 'Admin — Send payment reminder email' })
  sendReminder(@Param('id') id: string) {
    return this.paymentsService.sendReminder(id);
  }

  @Roles(Role.ADMIN)
  @Delete(':id')
  @ApiOperation({ summary: 'Admin — Delete a payment (unpaid only)' })
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }

  @Roles(Role.BRIDE)
  @Get('me')
  @ApiOperation({ summary: 'Bride — Get own payments' })
  getBridePayments(@CurrentUser() user: { id: string }) {
    return this.paymentsService.getBridePayments(user.id);
  }
}
