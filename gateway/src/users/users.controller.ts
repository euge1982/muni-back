
import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Usuarios')
@ApiBearerAuth()
@Controller()
export class UsersController {
  constructor(
    @Inject('USERS_SERVICE')
    private readonly usersService: ClientProxy,
  ) {}

  // Obtener todos los usuarios
  @Get('users')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  findAllUsers() {
    return this.usersService.send('find-users', {});
  }

  // Consultar perfil propio
  @Get('users/me')
  @ApiOperation({ summary: 'Consultar el perfil propio' })
  @UseGuards(JwtAuthGuard)
  async getMyProfile(
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (
      !req.user.roles?.some((role) =>
        ['PARTICIPANTE', 'INSTRUCTOR'].includes(role),
      )
    ) {
      throw new ForbiddenException(
        'Esta operación está disponible para participantes e instructores',
      );
    }

    const userId = Number(req.user.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('El usuario autenticado no es válido');
    }

    const user = await firstValueFrom(
      this.usersService.send('find-user', { userId }),
    );

    if (!user) {
      throw new NotFoundException('No se encontró el perfil');
    }

    return user;
  }

  // Actualizar perfil propio
  @Patch('users/me')
  @ApiOperation({ summary: 'Actualizar el perfil propio' })
  @ApiBody({
    required: true,
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'Usuario Actualizado' },
        lastName: { type: 'string', example: 'Participante' },
        phone: { type: 'string', nullable: true, example: '299123456789' },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async updateMyProfile(
    @Body()
    data: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (
      !req.user.roles?.some((role) =>
        ['PARTICIPANTE', 'INSTRUCTOR'].includes(role),
      )
    ) {
      throw new ForbiddenException(
        'Esta operación está disponible para participantes e instructores',
      );
    }

    const userId = Number(req.user.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new BadRequestException('El usuario autenticado no es válido');
    }

    const profile: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    } = {};

    if (data.firstName !== undefined) {
      if (
        typeof data.firstName !== 'string' ||
        !data.firstName.trim()
      ) {
        throw new BadRequestException('El nombre no es válido');
      }

      profile.firstName = data.firstName.trim();
    }

    if (data.lastName !== undefined) {
      if (
        typeof data.lastName !== 'string' ||
        !data.lastName.trim()
      ) {
        throw new BadRequestException('El apellido no es válido');
      }

      profile.lastName = data.lastName.trim();
    }

    if (data.phone !== undefined) {
      if (data.phone !== null && typeof data.phone !== 'string') {
        throw new BadRequestException('El teléfono no es válido');
      }

      profile.phone =
        typeof data.phone === 'string'
          ? data.phone.trim() || null
          : null;
    }

    if (Object.keys(profile).length === 0) {
      throw new BadRequestException(
        'Ingresá al menos un dato para actualizar',
      );
    }

    return firstValueFrom(
      this.usersService.send('update-user-profile', {
        userId,
        profile,
      }),
    );
  }

  // Actualizar roles
  @Patch('users/:id/roles')
  @ApiOperation({ summary: 'Actualizar roles de un usuario' })
  @ApiParam({
    name: 'id',
    example: 6,
    description: 'ID del usuario',
  })
  @ApiBody({
    schema: {
      example: {
        roles: ['PARTICIPANTE', 'INSTRUCTOR'],
      },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateUserRoles(
    @Param('id') id: string,
    @Body() data: { roles: string[] },
    @Req() req: { user: { userId: number } },
  ) {
    return this.usersService.send('update-user-roles', {
      id: Number(id),
      roles: data.roles,
      requesterId: req.user.userId,
    });
  }

  // Actualizar estado
  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Actualizar el estado de un usuario' })
  @ApiParam({
    name: 'id',
    example: 6,
    description: 'ID del usuario',
  })
  @ApiBody({
    schema: {
      example: {
        status: 'INACTIVE',
      },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  updateUserStatus(
    @Param('id') id: string,
    @Body() data: { status: 'ACTIVE' | 'INACTIVE' },
  ) {
    return this.usersService.send('update-user-status', {
      id: Number(id),
      status: data.status,
    });
  }
}
