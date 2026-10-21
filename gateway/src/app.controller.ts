import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { firstValueFrom } from 'rxjs';

@ApiTags('Muni API')
@ApiBearerAuth()
@Controller()
export class AppController {
  constructor(
    @Inject('USERS_SERVICE')
    private readonly usersService: ClientProxy,

    @Inject('ACTIVITIES_SERVICE')
    private readonly activitiesService: ClientProxy,

    @Inject('ATTENDANCE_SERVICE')
    private readonly attendanceService: ClientProxy,

    @Inject('LOCATION_SERVICE')
    private readonly locationService: ClientProxy,

    private readonly authService: AuthService,
  ) { }

  // USUARIOS

  @Get('users')
  @ApiOperation({ summary: 'Obtener todos los usuarios' })
  @UseGuards(JwtAuthGuard)
  findAllUsers() {
    return this.usersService.send('find-users', {});
  }

  @Post('users')
  @ApiOperation({ summary: 'Crear un nuevo usuario' })
  @ApiBody({
    schema: {
      example: {
        firstName: 'Juan',
        lastName: 'Perez',
        email: 'juan@test',
        password: '123456',
        phone: '299123456789',
      },
    },
  })
  createUser(@Body() data: any) {
    return this.usersService.send('create-user', data);
  }


  @Post('auth/register')
  @ApiOperation({ summary: 'Registrar un nuevo participante' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'password'],
      properties: {
        firstName: { type: 'string', example: 'Juan' },
        lastName: { type: 'string', example: 'Pérez' },
        email: { type: 'string', format: 'email', example: 'juan@example.com' },
        password: { type: 'string', minLength: 8, example: 'ClaveSegura123' },
        phone: { type: 'string', example: '2991234567' },
      },
    },
  })
  async registerParticipant(
    @Body()
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
    },
  ) {
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    const email = data.email?.trim().toLowerCase();
    const password = data.password;
    const phone = data.phone?.trim() || undefined;

    if (!firstName || !lastName || !email || !password) {
      throw new BadRequestException(
        'Nombre, apellido, correo y contraseña son obligatorios',
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException(
        'El correo electrónico no es válido',
      );
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres',
      );
    }

    return firstValueFrom(
      this.usersService.send('create-user', {
        firstName,
        lastName,
        email,
        password,
        ...(phone && { phone }),
      }),
    );
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'Iniciar Sesion' })
  @ApiBody({
    schema: {
      example: {
        email: 'juan@test.com',
        password: '123456',
      },
    },
  })
  login(@Body() data: { email: string; password: string }) {
    return this.authService.login(data.email, data.password);
  }

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
  ) {
    return this.usersService.send('update-user-roles', {
      id: Number(id),
      roles: data.roles,
    });
  }

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
        location: 'Centro Cultural Cipolletti',
        latitude: -38.9339,
        longitude: -67.9903,
        allowedRadius: 100,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  createMeeting(
    @Param('id') id: string,
    @Body()
    data: {
      dateTime: Date;
      location: string;
      latitude: number;
      longitude: number;
      allowedRadius: number;
    },
  ) {
    return this.activitiesService.send('create-meeting', {
      activityId: Number(id),
      dateTime: data.dateTime,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      allowedRadius: data.allowedRadius,
    });
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
        location: { type: 'string' },
        latitude: { type: 'number', example: -38.924056 },
        longitude: { type: 'number', example: -67.981111 },
        allowedRadius: { type: 'number', example: 100 },
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
      location?: string;
      latitude?: number;
      longitude?: number;
      allowedRadius?: number;
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
        ...(data.location !== undefined && {
          location: data.location,
        }),
        ...(data.latitude !== undefined && {
          latitude: Number(data.latitude),
        }),
        ...(data.longitude !== undefined && {
          longitude: Number(data.longitude),
        }),
        ...(data.allowedRadius !== undefined && {
          allowedRadius: Number(data.allowedRadius),
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
      }),
    );
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

  // ASISTENCIA

  @Post('attendance/open')
  @ApiOperation({ summary: 'Abrir una sesión de asistencia' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['meetingId', 'startTime', 'endTime'],
      properties: {
        meetingId: { type: 'number', example: 1 },
        startTime: {
          type: 'string',
          format: 'date-time',
          example: '2026-10-20T15:35:00.000Z',
        },
        endTime: {
          type: 'string',
          format: 'date-time',
          example: '2026-10-20T16:05:00.000Z',
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async openAttendance(
    @Body()
    data: {
      meetingId: number;
      startTime: Date;
      endTime: Date;
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede abrir la asistencia',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(data.meetingId),
      }),
    );

    if (!meeting) {
      throw new ForbiddenException('La reunión no existe o no está disponible');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede abrir la asistencia',
      );
    }
    try {
      return await firstValueFrom(
        this.attendanceService.send('open-attendance', {
          ...data,
          openedBy: Number(req.user.userId),
        }),
      );
    } catch (error) {
      throw error;
    }
  }

  @Post('attendance/close')
  @ApiOperation({ summary: 'Cerrar una sesión de asistencia' })
  @UseGuards(JwtAuthGuard)
  async closeAttendance(
    @Body() data: { sessionId: number },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];
    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede cerrar la asistencia',
      );
    }
    const session = await firstValueFrom(
      this.attendanceService.send('find-attendance-session', {
        sessionId: Number(data.sessionId),
      }),
    );

    if (!session) {
      throw new ForbiddenException('La sesión de asistencia no existe');
    }
    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );
    if (!meeting) {
      throw new ForbiddenException('La reunión no existe o no está disponible');
    }
    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede cerrar la asistencia',
      );
    }
    return this.attendanceService.send('close-attendance', {
      sessionId: Number(data.sessionId),
    });
  }


  @Get('attendance/meeting/:meetingId/session')
  @ApiOperation({
    summary: 'Consultar la sesión de asistencia de un encuentro',
  })
  @UseGuards(JwtAuthGuard)
  async findAttendanceSessionByMeeting(
    @Param('meetingId') meetingId: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];
    const id = Number(meetingId);

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException('El ID del encuentro no es válido');
    }

    const isAdmin = roles.includes('ADMINISTRADOR');
    const isInstructor = roles.includes('INSTRUCTOR');
    const isParticipant = roles.includes('PARTICIPANTE');

    if (!isAdmin && !isInstructor && !isParticipant) {
      throw new ForbiddenException(
        'No tenés permiso para consultar la sesión de asistencia',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', { id }),
    );

    if (!meeting) {
      throw new ForbiddenException(
        'El encuentro no existe o no está disponible',
      );
    }

    if (isInstructor && !isAdmin) {
      if (
        Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
      ) {
        throw new ForbiddenException(
          'Solo el responsable de la actividad puede consultar la sesión',
        );
      }
    }
    if (isParticipant && !isAdmin && !isInstructor) {
      const enrollment = await firstValueFrom(
        this.activitiesService.send('find-enrollment', {
          activityId: Number(meeting.activityId),
          participantId: Number(req.user.userId),
        }),
      );
      if (!enrollment || enrollment.status !== 'ACTIVE') {
        throw new ForbiddenException(
          'Necesitás una inscripción activa para consultar esta sesión',
        );
      }
    }
    return firstValueFrom(
      this.attendanceService.send(
        'find-attendance-session-by-meeting',
        { meetingId: id },
      ),
    );
  }

  @Post('attendance/checkin')
  @ApiOperation({ summary: 'Registrar asistencia del participante autenticado' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'latitude', 'longitude'],
      properties: {
        sessionId: { type: 'number', example: 1 },
        latitude: { type: 'number', example: -38.9339 },
        longitude: { type: 'number', example: -67.9903 },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  registerAttendance(
    @Body()
    data: {
      sessionId: number;
      latitude: number;
      longitude: number;
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    if (!req.user.roles?.includes('PARTICIPANTE')) {
      throw new ForbiddenException(
        'Solo los participantes pueden registrar su asistencia',
      );
    }

    return this.attendanceService.send('register-attendance', {
      ...data,
      participantId: Number(req.user.userId),
    });
  }

  @Get('attendance/history/:participantId')
  @ApiOperation({ summary: 'Consultar historial de asistencia' })
  @ApiParam({
    name: 'participantId',
    example: 5,
    description: 'ID del participante',
  })
  @UseGuards(JwtAuthGuard)
  attendanceHistory(
    @Param('participantId') participantId: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];
    const requestedId = Number(participantId);
    const ownId = Number(req.user.userId);

    if (
      !roles.includes('ADMINISTRADOR') &&
      !(roles.includes('PARTICIPANTE') && requestedId === ownId)
    ) {
      throw new ForbiddenException(
        'No tenés permiso para consultar este historial',
      );
    }

    return this.attendanceService.send('attendance-history', {
      participantId: requestedId,
    });
  }

  @Post('attendance/process-absences')
  @ApiOperation({
    summary: 'Procesar ausencias de una sesión',
    description:
      'Registra como ausentes a los participantes inscriptos que no registraron asistencia',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: {
          type: 'number',
          example: 3,
        },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async processAbsences(
    @Body() data: { sessionId: number },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede procesar ausencias',
      );
    }

    const session = await firstValueFrom(
      this.attendanceService.send('find-attendance-session', {
        sessionId: Number(data.sessionId),
      }),
    );

    if (!session) {
      throw new ForbiddenException('La sesión de asistencia no existe');
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );

    if (!meeting) {
      throw new ForbiddenException('La reunión no existe o no está disponible');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !== Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede procesar ausencias',
      );
    }

    return this.attendanceService.send('process-absences', {
      sessionId: Number(data.sessionId),
    });
  }

  // LOCALIZACION
  @Post('location/validate')
  @ApiOperation({ summary: 'Validar ubicacion de un participante' })
  @ApiBody({
    schema: {
      example: {
        latitude: -38.9339,
        longitude: -67.9903,
        classroomLatitude: -38.9339,
        classroomLongitude: -67.9903,
        allowedRadius: 100,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  validateLocation(
    @Body()
    data: {
      latitude: number;
      longitude: number;
      classroomLatitude: number;
      classroomLongitude: number;
      allowedRadius: number;
    },
  ) {
    return this.locationService.send('validate-location', data);
  }

  @Post('enrollments/:id/reactivate')
  @ApiOperation({ summary: 'Reactivar una inscripcion' })
  @ApiParam({
    name: 'id',
    example: 2,
    description: 'ID de la inscripcion',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  reactivateEnrollment(@Param('id') id: string) {
    return this.activitiesService.send('reactivate-enrollment', {
      enrollmentId: Number(id),
    });
  }
}
