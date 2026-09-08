import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthService } from './auth/auth.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

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

  @Get('users')
  @UseGuards(JwtAuthGuard)
  findAllUsers() {
    return this.usersService.send('find-users', {});
  }

  @Post('users')
  createUser(@Body() data: any) {
    return this.usersService.send('create-user', data);
  }

  @Post('auth/login')
  login(@Body() data: { email: string; password: string }) {
    return this.authService.login(data.email, data.password);
  }

  @Patch('users/:id/roles')
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

  @Get('activities')
  @UseGuards(JwtAuthGuard)
  findAllActivities() {
    return this.activitiesService.send('find-activities', {});
  } 

  @Post('activities')
  @UseGuards(JwtAuthGuard, RolesGuard)
  createActivity(@Body() data: any) {
    return this.activitiesService.send('create-activity', data);
  }

  
  @Get('activities/:id')
  @UseGuards(JwtAuthGuard)
  findActivity(@Param('id') id: string) {
    return this.activitiesService.send('find-activity', {
      id: Number(id),
    });
  }

  @Post('activities/:id/meetings')
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

  @Post('attendance/open')
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
  @UseGuards(JwtAuthGuard)
  attendanceHistory(
    @Param('participantId') participantId: string,
  ) {
    return this.attendanceService.send('attendance-history', {
      participantId: Number(participantId),
    });
  }

  @Post('location/validate')
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  reactivateEnrollment(@Param('id') id: string) {
    return this.activitiesService.send('reactivate-enrollment', {
      enrollmentId: Number(id),
    });
  }

  @Post('attendance/process-absences')
  @UseGuards(JwtAuthGuard)
  processAbsences(@Body() data: { sessionId: number }) {
    return this.attendanceService.send('process-absences', data);
  }

}