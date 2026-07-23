import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from '../../application/auth.service.js';
import {
  LoginDto,
  AuthResponseDto,
  UserResponseDto,
  RequestPasswordRecoveryDto,
  VerifyPasswordRecoveryCodeDto,
  ResetPasswordWithTokenDto,
} from '../dto/auth.dto.js';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator.js';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user.js';
import { Public } from '../../../../common/presentation/decorators/public.decorator.js';
import { EnvironmentVariables } from '../../../../config/env.validation.js';

const REFRESH_COOKIE = 'sga_refresh';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private setRefreshCookie(res: Response, token: string): void {
    const isProd = this.config.get('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      domain: this.config.get<string>('COOKIE_DOMAIN'),
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      path: '/api/v1/auth',
      domain: this.config.get<string>('COOKIE_DOMAIN'),
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login with document type, document number and password',
  })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.loginByDocument(
      dto.documentType,
      dto.documentNumber,
      dto.password,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    );
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.userResponse };
  }

  @Public()
  @Post('password-recovery/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password recovery code' })
  async requestPasswordRecovery(
    @Body() dto: RequestPasswordRecoveryDto,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    return this.authService.requestPasswordRecovery(
      dto.documentType,
      dto.documentNumber,
      {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
      },
    );
  }

  @Public()
  @Post('password-recovery/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify password recovery code' })
  async verifyPasswordRecoveryCode(
    @Body() dto: VerifyPasswordRecoveryCodeDto,
  ): Promise<{ recoveryToken: string }> {
    return this.authService.verifyPasswordRecoveryCode(
      dto.documentType,
      dto.documentNumber,
      dto.code,
    );
  }

  @Public()
  @Post('password-recovery/reset')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using recovery token' })
  async resetPassword(
    @Body() dto: ResetPasswordWithTokenDto,
  ): Promise<{ message: string }> {
    if (dto.newPassword !== dto.newPasswordConfirmation) {
      throw new Error('Las contraseñas no coinciden');
    }
    return this.authService.resetPasswordWithToken(
      dto.recoveryToken,
      dto.newPassword,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!refreshToken) throw new Error('Missing refresh token');
    const result = await this.authService.refresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    this.setRefreshCookie(res, result.refreshToken);
    return { accessToken: result.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    await this.authService.logout(refreshToken);
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout all sessions' })
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.userId);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get current user' })
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.authService.getMe(user.userId);
  }
}
