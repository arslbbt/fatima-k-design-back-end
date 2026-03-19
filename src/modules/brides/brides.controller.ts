import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { BridesService } from './brides.service';
import { UpdateBrideProfileDto } from './dto/update-bride-profile.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Brides')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('brides')
export class BridesController {
  constructor(private bridesService: BridesService) {}

  // ── Bride-facing ─────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Bride — get own profile' })
  getMyProfile(@CurrentUser() user: { id: string }) {
    return this.bridesService.getMyProfile(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Bride — update own profile' })
  updateMyProfile(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdateBrideProfileDto,
  ) {
    return this.bridesService.updateMyProfile(user.id, dto);
  }

  // ── Admin-facing ─────────────────────────────────────────────

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — list all brides' })
  findAll() {
    return this.bridesService.findAll();
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — get a specific bride profile' })
  findOne(@Param('id') id: string) {
    return this.bridesService.findOne(id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Admin — remove a bride account' })
  remove(@Param('id') id: string) {
    return this.bridesService.remove(id);
  }
}
