import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { UpdateAdminDto } from './dto/update-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('Admin Management')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/admins')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new admin account' })
  create(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Get()
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
}
