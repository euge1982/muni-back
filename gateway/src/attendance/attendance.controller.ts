
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

@ApiTags('Asistencias')
@ApiBearerAuth()
@Controller()
export class AttendanceController {
  constructor(
    @Inject('ATTENDANCE_SERVICE')
    private readonly attendanceService: ClientProxy,

    @Inject('ACTIVITIES_SERVICE')
    private readonly activitiesService: ClientProxy,
  ) {}

  // ABRIR SESIÓN DE ASISTENCIA

  @Post('attendance/open')
  @ApiOperation({ summary: 'Abrir una sesión de asistencia' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['meetingId'],
      properties: {
        meetingId: { type: 'number', example: 1 },
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  async openAttendance(
    @Body() data: { meetingId: number },
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
      throw new ForbiddenException(
        'La reunión no existe o no está disponible',
      );
    }

    if (meeting.activity?.status !== 'ACTIVE') {
      throw new BadRequestException(
        'No se puede abrir la asistencia de una actividad finalizada',
      );
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede abrir la asistencia',
      );
    }

    return firstValueFrom(
      this.attendanceService.send('open-attendance', {
        meetingId: Number(data.meetingId),
        openedBy: Number(req.user.userId),
      }),
    );
  }

  // CERRAR SESIÓN DE ASISTENCIA

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
      throw new ForbiddenException(
        'La sesión de asistencia no existe',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );

    if (!meeting) {
      throw new ForbiddenException(
        'La reunión no existe o no está disponible',
      );
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede cerrar la asistencia',
      );
    }

    return this.attendanceService.send('close-attendance', {
      sessionId: Number(data.sessionId),
    });
  }

  // CONSULTAR SESIÓN POR ENCUENTRO

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
      throw new BadRequestException(
        'El ID del encuentro no es válido',
      );
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

  // CONSULTAR ASISTENCIAS DE UNA SESIÓN

  @Get('attendance/session/:sessionId/records')
  @ApiOperation({
    summary: 'Consultar las asistencias registradas en una sesión',
  })
  @UseGuards(JwtAuthGuard)
  async findAttendancesBySession(
    @Param('sessionId') sessionId: string,
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const id = Number(sessionId);
    const roles = req.user.roles ?? [];

    if (!Number.isInteger(id) || id <= 0) {
      throw new BadRequestException(
        'El ID de la sesión no es válido',
      );
    }

    const isAdmin = roles.includes('ADMINISTRADOR');
    const isInstructor = roles.includes('INSTRUCTOR');

    if (!isAdmin && !isInstructor) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede consultar las asistencias',
      );
    }

    const session = await firstValueFrom(
      this.attendanceService.send('find-attendance-session', {
        sessionId: id,
      }),
    );

    if (!session) {
      throw new NotFoundException('La sesión no existe');
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );

    if (!meeting) {
      throw new NotFoundException('El encuentro no existe');
    }

    if (
      !isAdmin &&
      Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede consultar estas asistencias',
      );
    }

    return firstValueFrom(
      this.attendanceService.send('find-attendances-by-session', {
        sessionId: id,
      }),
    );
  }

  // REGISTRAR ASISTENCIA

  @Post('attendance/checkin')
  @ApiOperation({
    summary: 'Registrar asistencia del participante autenticado',
  })
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

  // HISTORIAL DE ASISTENCIA

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

  // PROCESAR AUSENCIAS

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
      throw new ForbiddenException(
        'La sesión de asistencia no existe',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );

    if (!meeting) {
      throw new ForbiddenException(
        'La reunión no existe o no está disponible',
      );
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede procesar ausencias',
      );
    }

    return this.attendanceService.send('process-absences', {
      sessionId: Number(data.sessionId),
    });
  }

  // MODIFICAR ASISTENCIA MANUALMENTE

  @Patch('attendance/manual')
  @ApiOperation({ summary: 'Modificar asistencia manualmente' })
  @UseGuards(JwtAuthGuard)
  async updateManualAttendance(
    @Body()
    data: {
      sessionId: number;
      participantId: number;
      status: 'PRESENT' | 'ABSENT';
    },
    @Req() req: { user: { userId: number; roles: string[] } },
  ) {
    const roles = req.user.roles ?? [];

    if (
      !roles.includes('INSTRUCTOR') &&
      !roles.includes('ADMINISTRADOR')
    ) {
      throw new ForbiddenException(
        'Solo un instructor o administrador puede modificar asistencias',
      );
    }

    const session = await firstValueFrom(
      this.attendanceService.send('find-attendance-session', {
        sessionId: Number(data.sessionId),
      }),
    );

    if (!session) {
      throw new NotFoundException(
        'La sesión de asistencia no existe',
      );
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: Number(session.meetingId),
      }),
    );

    if (!meeting) {
      throw new NotFoundException('El encuentro no existe');
    }

    if (
      !roles.includes('ADMINISTRADOR') &&
      Number(meeting.activity?.responsibleId) !==
        Number(req.user.userId)
    ) {
      throw new ForbiddenException(
        'Solo el responsable de la actividad puede modificar asistencias',
      );
    }

    return firstValueFrom(
      this.attendanceService.send('update-manual-attendance', {
        sessionId: Number(data.sessionId),
        participantId: Number(data.participantId),
        status: data.status,
      }),
    );
  }
}
