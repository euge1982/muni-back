import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

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
  ) {}


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
    @Body() data: {
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

  @Post('activities/:id/enrollments')
  @ApiOperation({ summary: 'Inscribir un participante en una actividad' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @ApiBody({
    schema: {
      example: {
        participantId: 5,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  createEnrollment(
    @Param('id') id: string,
    @Body() data: {
     participantId: number;
   },
  ) {
    return this.activitiesService.send('create-enrollment', {
      activityId: Number(id),
      participantId: data.participantId,
    });
  }

  @Patch('activities/:id/enrollments/withdraw')
  @ApiOperation({ summary: 'Retirar un participante de una actividad' })
  @ApiParam({
    name: 'id',
    example: 1,
    description: 'ID de la actividad',
  })
  @ApiBody({
    schema: {
      example: {
        participantId: 5,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  withdrawEnrollment(
    @Param('id') id: string,
    @Body() data: { participantId: number },
  ) {
    return this.activitiesService.send('withdraw-enrollment', {
      activityId: Number(id),
      participantId: data.participantId,
    });
  }


  // ASISTENCIA
  @Post('attendance/open')
  @ApiOperation({ summary: 'Abrir una sesión de asistencia' })
  @ApiBody({
    schema: {
      example: {
        meetingId: 5,
        openedBy: 6,
        startTime: '2026-09-01T20:00:00.000Z',
        endTime: '2026-09-01T20:30:00.000Z',
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  openAttendance(
    @Body()
    data: {
      meetingId: number;
      openedBy: number;
      startTime: Date;
      endTime: Date;
    },
  ) {
    return this.attendanceService.send('open-attendance', data);
  }

  @Post('attendance/close')
  @ApiOperation({ summary: 'Cerrar una sesión de asistencia' })
  @ApiBody({
    schema: {
      example: {
        sessionId: 5,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  closeAttendance(
    @Body()
    data: {
      sessionId: number;
    },
  ) {
    return this.attendanceService.send('close-attendance', data);
  }

  @Post('attendance/checkin')
  @ApiOperation({ summary: 'Registrar asistencia de un participante' })
  @ApiBody({
    schema: {
      example: {
        sessionId: 5,
        participantId: 6,
        latitude: -38.9339,
        longitude: -67.9903,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  registerAttendance(
    @Body()
    data: {
      sessionId: number;
      participantId: number;
      latitude: number;
      longitude: number;
    },
  ) {
    return this.attendanceService.send('register-attendance', data);
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
  ) {
    return this.attendanceService.send('attendance-history', {
      participantId: Number(participantId),
    });
  }

  @Post('attendance/process-absences')
  @ApiOperation({ 
    summary: 'Procesar ausencias de una sesion',
    description: 'Registra como ausentes a los partivipantes inscriptos que no registraron asistencia',
  })
  @ApiBody({
    schema: {
      example: {
        sessionId: 5,
      },
    },
  })
  @UseGuards(JwtAuthGuard)
  processAbsences(@Body() data: { sessionId: number }) {
    return this.attendanceService.send('process-absences', data);
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