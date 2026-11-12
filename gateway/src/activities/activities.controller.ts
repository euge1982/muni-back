
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Delete,
  Req,
  UseGuards,
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

@ApiTags('Actividades')
@ApiBearerAuth()
@Controller()
export class ActivitiesController {
  constructor(
    @Inject('ACTIVITIES_SERVICE')
    private readonly activitiesService: ClientProxy,

    @Inject('USERS_SERVICE')
    private readonly usersService: ClientProxy,
  ) { }

  // ACTIVIDADES

  @Get('public/activities')
  @ApiOperation({
    summary: 'Obtener actividades activas para la página pública',
  })
  findPublicActivities() {
    return this.activitiesService.send('find-activities', {});
  }

  @Get('activities')
  @ApiOperation({ summary: 'Obtener todas las actividades' })
  @UseGuards(JwtAuthGuard)
  findAllActivities() {
    return this.activitiesService.send('find-activities', {});
  }

  @Post('activities')
  @ApiOperation({ summary: 'Crear una nueva actividad' })
  @ApiBody({
    schema: {
      example: {
        name: 'Actividad 1',
        description: 'Descripción de la actividad 1',
        capacity: 20,
        enrollmentStart: '2021-01-01T00:00:00.000Z',
        enrollmentEnd: '2021-01-01T00:00:00.000Z',
        responsibleId: 6,
      },
    },
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  createActivity(@Body() data: any) {
    return this.activitiesService.send('create-activity', data);
  }

  @Patch('activities/:id')
  @ApiOperation({ summary: 'Actualizar una actividad' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async updateActivity(
    @Param('id') id: string,
    @Body()
    data: {
      name?: string;
      description?: string | null;
      capacity?: number;
      enrollmentStart?: string;
      enrollmentEnd?: string;
      responsibleId?: number;
    },
  ) {
    const activityId = Number(id);

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    const activityData = {
      ...data,
      ...(data.enrollmentStart !== undefined && {
        enrollmentStart: new Date(data.enrollmentStart),
      }),
      ...(data.enrollmentEnd !== undefined && {
        enrollmentEnd: new Date(data.enrollmentEnd),
      }),
      ...(data.capacity !== undefined && {
        capacity: Number(data.capacity),
      }),
      ...(data.responsibleId !== undefined && {
        responsibleId: Number(data.responsibleId),
      }),
    };

    return firstValueFrom(
      this.activitiesService.send('update-activity', {
        id: activityId,
        ...activityData,
      }),
    );
  }

  @Delete('activities/:id')
  @ApiOperation({
    summary: 'Eliminar una actividad sin registros asociados',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async deleteActivity(@Param('id') id: string) {
    const activityId = Number(id);

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    return firstValueFrom(
      this.activitiesService.send('delete-activity', {
        id: activityId,
      }),
    );
  }

  @Patch('activities/:id/finish')
  @ApiOperation({
    summary: 'Finalizar una actividad sin eliminar sus registros',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async finishActivity(@Param('id') id: string) {
    const activityId = Number(id);

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    return firstValueFrom(
      this.activitiesService.send('finish-activity', {
        id: activityId,
      }),
    );
  }

  @Patch('activities/:id/reactivate')
  @ApiOperation({ summary: 'Reactivar una actividad finalizada' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  async reactivateActivity(@Param('id') id: string) {
    const activityId = Number(id);

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    return firstValueFrom(
      this.activitiesService.send('reactivate-activity', {
        id: activityId,
      }),
    );
  }

  @Get('activities/:id')
  @ApiOperation({ summary: 'Obtener una actividad por ID' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard)
  findActivity(@Param('id') id: string) {
    return this.activitiesService.send('find-activity', {
      id: Number(id),
    });
  }

  // INSCRIPCIONES

  @Get('participant/enrollments')
  @ApiOperation({
    summary: 'Consultar las inscripciones del participante autenticado',
  })
  @UseGuards(JwtAuthGuard)
  findMyEnrollments(
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (!req.user.roles?.includes('PARTICIPANTE')) {
      throw new ForbiddenException(
        'Solo los participantes pueden consultar sus inscripciones',
      );
    }

    return this.activitiesService.send(
      'find-enrollments-by-participant',
      {
        participantId: Number(req.user.userId),
      },
    );
  }

  @Get('activities/:id/active-enrollments')
  @ApiOperation({
    summary: 'Consultar inscripciones activas de una actividad',
  })
  @UseGuards(JwtAuthGuard)
  async findActiveEnrollments(
    @Param('id') id: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const activityId = Number(id);
    const roles = req.user.roles ?? [];

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede consultar las inscripciones',
      );
    }

    const activity = await firstValueFrom(
      this.activitiesService.send('find-activity', {
        id: activityId,
      }),
    );

    if (!activity) {
      throw new NotFoundException('La actividad no existe');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(activity.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede consultar sus inscripciones',
      );
    }

    const enrollments = await firstValueFrom(
      this.activitiesService.send('find-active-enrollments', {
        activityId,
      }),
    );

    const activeEnrollments = Array.isArray(enrollments)
      ? enrollments
      : [];

    const participants = await Promise.all(
      activeEnrollments.map(async (enrollment) => {
        const participant = await firstValueFrom(
          this.usersService.send('find-user', {
            userId: Number(enrollment.participantId),
          }),
        );

        return {
          ...enrollment,
          participant: participant
            ? {
              id: participant.id,
              firstName: participant.firstName,
              lastName: participant.lastName,
            }
            : null,
        };
      }),
    );

    return participants;
  }

  @Get('activities/:id/enrollments')
  @ApiOperation({
    summary: 'Consultar todas las inscripciones de una actividad',
  })
  @UseGuards(JwtAuthGuard)
  async findAllEnrollmentsByActivity(
    @Param('id') id: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const activityId = Number(id);
    const roles = req.user.roles ?? [];

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede consultar las inscripciones',
      );
    }

    const activity = await firstValueFrom(
      this.activitiesService.send('find-activity', {
        id: activityId,
      }),
    );

    if (!activity) {
      throw new NotFoundException('La actividad no existe');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(activity.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede consultar sus inscripciones',
      );
    }

    const enrollments = await firstValueFrom(
      this.activitiesService.send('find-all-enrollments-by-activity', {
        activityId,
      }),
    );

    const allEnrollments = Array.isArray(enrollments)
      ? enrollments
      : [];

    const participants = await Promise.all(
      allEnrollments.map(async (enrollment) => {
        const participant = await firstValueFrom(
          this.usersService.send('find-user', {
            userId: Number(enrollment.participantId),
          }),
        );

        return {
          ...enrollment,
          participant: participant
            ? {
              id: participant.id,
              firstName: participant.firstName,
              lastName: participant.lastName,
            }
            : null,
        };
      }),
    );

    return participants;
  }

  @Post('activities/:id/enrollments')
  @ApiOperation({
    summary: 'Inscribir al participante autenticado en una actividad',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard)
  createEnrollment(
    @Param('id') id: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (!req.user.roles?.includes('PARTICIPANTE')) {
      throw new ForbiddenException(
        'Solo los participantes pueden inscribirse',
      );
    }

    return this.activitiesService.send('create-enrollment', {
      activityId: Number(id),
      participantId: Number(req.user.userId),
    });
  }

  @Patch('activities/:id/enrollments/withdraw')
  @ApiOperation({
    summary: 'Retirar al participante autenticado de una actividad',
  })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @UseGuards(JwtAuthGuard)
  withdrawEnrollment(
    @Param('id') id: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (!req.user.roles?.includes('PARTICIPANTE')) {
      throw new ForbiddenException(
        'Solo los participantes pueden retirarse de sus inscripciones',
      );
    }

    return this.activitiesService.send('withdraw-enrollment', {
      activityId: Number(id),
      participantId: Number(req.user.userId),
    });
  }

  @Post('enrollments/:id/reactivate')
  @ApiOperation({ summary: 'Reactivar una inscripción' })
  @ApiParam({
    name: 'id',
    example: 2,
    description: 'ID de la inscripción',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  reactivateEnrollment(@Param('id') id: string) {
    return this.activitiesService.send('reactivate-enrollment', {
      enrollmentId: Number(id),
    });
  }

  // ENCUENTROS

  @Post('activities/:id/meetings')
  @ApiOperation({ summary: 'Crear una nueva reunión para una actividad' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @ApiBody({
    schema: {
      example: {
        dateTime: '2026-09-01T20:00:00.000Z',
        locationId: 1,
        allowedRadius: 100,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async createMeeting(
    @Param('id') id: string,
    @Body()
    data: {
      dateTime: Date;
      locationId: number;
      allowedRadius: number;
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const activityId = Number(id);
    const roles = req.user.roles ?? [];

    if (!Number.isInteger(activityId) || activityId <= 0) {
      throw new BadRequestException('El ID de la actividad no es válido');
    }

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede crear encuentros',
      );
    }

    const activity = await firstValueFrom(
      this.activitiesService.send('find-activity', {
        id: activityId,
      }),
    );

    if (!activity) {
      throw new NotFoundException('La actividad no existe');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(activity.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede crear encuentros',
      );
    }

    return firstValueFrom(
      this.activitiesService.send('create-meeting', {
        activityId,
        dateTime: data.dateTime,
        locationId: Number(data.locationId),
        allowedRadius: Number(data.allowedRadius),
      }),
    );
  }

  @Patch('meetings/:id')
  @ApiOperation({ summary: 'Actualizar un encuentro existente' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID del encuentro',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        dateTime: { type: 'string', format: 'date-time' },
        locationId: { type: 'number', example: 1 },
        status: {
          type: 'string',
          enum: ['SCHEDULED', 'SUSPENDED', 'FINISHED'],
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async updateMeeting(
    @Param('id') id: string,
    @Body()
    data: {
      dateTime?: Date;
      locationId?: number;
      status?: 'SCHEDULED' | 'SUSPENDED' | 'FINISHED';
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const meetingId = Number(id);

    if (!Number.isInteger(meetingId) || meetingId <= 0) {
      throw new BadRequestException('El ID del encuentro no es válido');
    }

    const roles = req.user.roles ?? [];

    if (
      !roles.includes('ADMINISTRADOR') &&
      !roles.includes('INSTRUCTOR')
    ) {
      throw new ForbiddenException(
        'Solo un administrador o instructor puede actualizar el encuentro',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: meetingId,
      }),
    );

    if (!meeting) {
      throw new BadRequestException('El encuentro no existe');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede actualizar el encuentro',
      );
    }

    return firstValueFrom(
      this.activitiesService.send('update-meeting', {
        id: meetingId,
        ...(data.dateTime !== undefined && {
          dateTime: data.dateTime,
        }),
        ...(data.locationId !== undefined && {
          locationId: Number(data.locationId),
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
      }),
    );
  }

  // UBICACIONES DE ENCUENTROS

  @Get('meeting-locations')
  @ApiOperation({ summary: 'Consultar ubicaciones disponibles' })
  @UseGuards(JwtAuthGuard)
  async findMeetingLocations(
    @Req() req: { user: { roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];

    if (
      !roles.includes('ADMINISTRADOR') &&
      !roles.includes('INSTRUCTOR')
    ) {
      throw new ForbiddenException(
        'Solo administradores e instructores pueden consultar ubicaciones',
      );
    }

    return firstValueFrom(
      this.activitiesService.send('find-meeting-locations', {}),
    );
  }

  @Post('meeting-locations')
  @ApiOperation({ summary: 'Registrar una ubicación' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          example: 'Centro Cultural Cipolletti',
        },
        latitude: {
          type: 'number',
          example: -38.9339,
        },
        longitude: {
          type: 'number',
          example: -67.9903,
        },
      },
      required: ['name', 'latitude', 'longitude'],
    },
  })
  @UseGuards(JwtAuthGuard)
  async createMeetingLocation(
    @Body()
    data: {
      name: string;
      latitude: number;
      longitude: number;
    },
    @Req() req: { user: { roles: string[] } },
  ) {
    if (!req.user.roles?.includes('ADMINISTRADOR')) {
      throw new ForbiddenException(
        'Solo un administrador puede registrar ubicaciones',
      );
    }

    return firstValueFrom(
      this.activitiesService.send('create-meeting-location', data),
    );
  }

  @Patch('meeting-locations/:id/deactivate')
  @ApiOperation({ summary: 'Desactivar una ubicación' })
  @UseGuards(JwtAuthGuard)
  async deactivateMeetingLocation(
    @Param('id') id: string,
    @Req() req: { user: { roles: string[] } },
  ) {
    if (!req.user.roles?.includes('ADMINISTRADOR')) {
      throw new ForbiddenException(
        'Solo un administrador puede desactivar ubicaciones',
      );
    }

    const locationId = Number(id);

    if (!Number.isInteger(locationId) || locationId <= 0) {
      throw new BadRequestException('El ID de la ubicación no es válido');
    }

    return firstValueFrom(
      this.activitiesService.send('deactivate-meeting-location', {
        id: locationId,
      }),
    );
  }
}
