import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { AttendanceService } from './attendance.service';

@Controller()
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
  ) { }

  @MessagePattern('open-attendance')
  openAttendance(data: {
    meetingId: number;
    openedBy: number;
    startTime: Date;
    endTime: Date;
  }) {
    return this.attendanceService.openAttendance(data);
  }

  @MessagePattern('close-attendance')
  closeAttendance(data: { sessionId: number }) {
    return this.attendanceService.closeAttendance(data);
  }

  @MessagePattern('register-attendance')
  registerAttendance(data: {
    sessionId: number;
    participantId: number;
    latitude: number;
    longitude: number;
  }) {
    return this.attendanceService.registerAttendance(data);
  }

  @MessagePattern('attendance-history')
  attendanceHistory(data: {
    participantId: number;
  }) {
    return this.attendanceService.attendanceHistory(
      data.participantId,
    );
  }

  @MessagePattern('process-absences')
  processAbsences(data: { sessionId: number }) {
    return this.attendanceService.processAbsences(data.sessionId);
  }

  @MessagePattern('find-attendance-session')
  findSession(data: { sessionId: number }) {
    return this.attendanceService.findSession(data.sessionId);
  }

  @MessagePattern('find-attendance-session-by-meeting')
  findSessionByMeeting(data: { meetingId: number }) {
    return this.attendanceService.findSessionByMeeting(data.meetingId);
  }

}