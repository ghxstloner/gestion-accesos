import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserService } from '../../application/user.service';
import {
  CreateUserDto,
  UpdateUserDto,
  UpdateUserRolesDto,
  ResetPasswordDto,
  UserResponseDto,
  UpdateUserPermissionsDto,
} from '../dto/auth.dto';
import { CurrentUser } from '../../../../common/presentation/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../common/presentation/decorators/authenticated-user';
import { RequirePermissions } from '../../../../common/presentation/decorators/permissions.decorator';
import { Public } from '../../../../common/presentation/decorators/public.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { PrismaService } from '../../../../common/infrastructure/prisma/prisma.service';
import {
  storeProfilePhoto,
  streamProfilePhoto,
} from '../../../../common/infrastructure/storage/profile-photo.storage';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly userService: UserService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('photo/:filename')
  photo(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) response: Response,
  ): StreamableFile {
    return streamProfilePhoto(filename, response);
  }

  @Post(':id/photo')
  @RequirePermissions('users.manage')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 3 * 1024 * 1024 } }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    await this.userService.findById(id, actor);
    const filename = await storeProfilePhoto(file);
    await this.prisma.user.update({
      where: { id },
      data: { photoUrl: `/users/photo/${filename}` },
    });
    return this.userService.findById(id, actor);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Create a user' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.create(dto, actor);
  }

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'List users' })
  async findAll(
    @Query('companyId') companyId?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() actor?: AuthenticatedUser,
  ): Promise<{
    items: UserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.userService.findAll(
      { companyId, search, status, page, limit },
      actor,
    );
  }

  @Get(':id')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Get a user by id' })
  async findById(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.findById(id, actor);
  }

  @Patch(':id')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Update a user' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.update(id, dto, actor);
  }

  @Post(':id/activate')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Activate a user' })
  async activate(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.activate(id, actor);
  }

  @Post(':id/block')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Block a user' })
  async block(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.block(id, actor);
  }

  @Post(':id/reset-password')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Reset user password' })
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<{ temporaryPassword: string }> {
    return this.userService.resetPassword(id, dto.newPassword, actor);
  }

  @Put(':id/roles')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Update user roles' })
  async updateRoles(
    @Param('id') id: string,
    @Body() dto: UpdateUserRolesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.updateRoles(id, dto.roleCodes, actor);
  }

  @Put(':id/permissions')
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Update additional user permissions' })
  async updatePermissions(
    @Param('id') id: string,
    @Body() dto: UpdateUserPermissionsDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    return this.userService.updatePermissions(id, dto.permissionCodes, actor);
  }
}
