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
import {
  ApiTags,
  ApiOperation,
  ApiCookieAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { ResetAdminPasswordDto } from './dto/reset-admin-password.dto';
import { RegisterBrideDto } from '../auth/dto/register-bride.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Management')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  // ── Self-management ──────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: 'Get own admin profile' })
  getMe(@CurrentUser() user: { id: string }) {
    return this.adminService.getAdminById(user.id);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin — get dashboard stats and recent data' })
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update own admin profile (name / email)' })
  updateMe(@CurrentUser() user: { id: string }, @Body() dto: UpdateAdminDto) {
    return this.adminService.updateAdmin(user.id, dto);
  }

  // ── User management (all users) ──────────────────────────────

  @Get('users')
  @ApiOperation({
    summary: 'List all users with pagination, search, role filter',
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false, enum: ['ADMIN', 'BRIDE'] })
  listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: 'ADMIN' | 'BRIDE',
  ) {
    return this.adminService.listAllUsers({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      search,
      role,
    });
  }

  // ── Bride management ─────────────────────────────────────────

  @Post('register-bride')
  @ApiOperation({ summary: 'Admin — register a new bride account' })
  registerBride(@Body() dto: RegisterBrideDto) {
    return this.adminService.registerBride(dto);
  }

  @Patch('brides/:id')
  @ApiOperation({ summary: 'Admin — update bride details' })
  updateBride(@Param('id') id: string, @Body() dto: any) {
    return this.adminService.updateBride(id, dto);
  }

  // ── Admin management ─────────────────────────────────────────

  @Post('create')
  @ApiOperation({ summary: 'Create a new admin account' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Get('list')
  @ApiOperation({ summary: 'List all admins' })
  findAll() {
    return this.adminService.findAllAdmins();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an admin account' })
  update(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.adminService.updateAdmin(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove an admin account' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.adminService.removeAdmin(id, user.id);
  }

  @Patch('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset any user password (admin or bride)' })
  resetUserPassword(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ResetAdminPasswordDto,
  ) {
    return this.adminService.resetUserPassword(id, user.id, dto);
  }
}
