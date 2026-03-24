import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ListAppointmentsQueryDto } from './dto/list-appointments-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Appointments')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private appointmentsService: AppointmentsService) {}

  // ── Admin ─────────────────────────────────────────────────────

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — create appointment for a bride' })
  create(
    @Body() dto: CreateAppointmentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.appointmentsService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin — list all appointments with optional date range',
  })
  findAll(@Query() query: ListAppointmentsQueryDto) {
    return this.appointmentsService.findAllForAdmin(
      query.from ? new Date(query.from) : undefined,
      query.to ? new Date(query.to) : undefined,
    );
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin — update appointment (including cancellation)',
  })
  update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — delete appointment' })
  remove(@Param('id') id: string) {
    return this.appointmentsService.remove(id);
  }

  // ── Bride ─────────────────────────────────────────────────────

  @Get('my')
  @Roles(Role.BRIDE)
  @ApiOperation({ summary: 'Bride — view own appointments' })
  findMine(@CurrentUser() user: { id: string }) {
    return this.appointmentsService.findAllForBride(user.id);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.BRIDE)
  @ApiOperation({ summary: 'Get single appointment (bride sees own only)' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string },
  ) {
    return this.appointmentsService.findOne(id, user.id, user.role);
  }
}
