import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * Login for both admin and bride
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login — sets HttpOnly cookie with JWT' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(dto);

    res.cookie('access_token', token, COOKIE_OPTIONS);

    return { message: 'Login successful', user };
  }

  /**
   * Logout — clears the cookie
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout — clears the auth cookie' })
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token', { path: '/' });
    return { message: 'Logged out successfully' };
  }

  /**
   * Get current authenticated user
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  async me(@CurrentUser() user: { id: string }) {
    return this.authService.getMe(user.id);
  }

  /**
   * Change own password — both admin and bride
   */
  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change own password (requires current password)' })
  async changePassword(
    @CurrentUser() user: { id: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
