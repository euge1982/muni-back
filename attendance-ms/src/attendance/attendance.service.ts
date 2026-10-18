import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject('LOCATION_SERVICE')
    private readonly locationService: ClientProxy,

    @Inject('ACTIVITIES_SERVICE')
    private readonly activitiesService: ClientProxy,

  ) { }

  async openAttendance(data: {
    meetingId: number;
    openedBy: number;
    startTime: Date;
    endTime: Date;
  }) {
    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: data.meetingId,
      }),
    );

    if (!meeting) {
      throw new RpcException({
        statusCode: 404,
        message: 'La reunión no existe',
      });
    }

    if (meeting.status === 'SUSPENDED') {
      throw new RpcException({
        statusCode: 400,
        message: 'La reunión está suspendida',
      });
    }

    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

    return this.prisma.attendanceSession.create({
      data: {
        meetingId: data.meetingId,
        openedBy: data.openedBy,
        startTime,
        endTime,
        status: 'OPEN',
      },
    });
  }

  async findSession(sessionId: number) {
    return this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
  }

  async closeAttendance(data: { sessionId: number }) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      throw new RpcException({
        statusCode: 404,
        message: 'La sesión de asistencia no existe',
      });
    }

    // Si ya está cerrada, no hacemos nada
    if (session.status === 'CLOSED') {
      return session;
    }

    const now = new Date();

    // No se puede cerrar antes de que termine
    if (now < session.endTime) {
      throw new RpcException({
        statusCode: 400,
        message: 'La sesión todavía está abierta',
      });
    }

    // Procesamos las ausencias antes de cerrar definitivamente
    await this.processAbsences(session.id);

    return this.prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
      },
    });
  }

  async registerAttendance(data: {
    sessionId: number;
    participantId: number;
    latitude: number;
    longitude: number;
  }) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: data.sessionId },
    });

    if (!session) {
      throw new RpcException({
        statusCode: 404,
        message: 'La sesión de asistencia no existe',
      });
    }

    const now = new Date();

    if (now < session.startTime) {
      throw new RpcException({
        statusCode: 400,
        message: 'La asistencia todavía no está abierta',
      });
    }

    if (now > session.endTime) {
      if (session.status === 'OPEN') {
        await this.processAbsences(session.id);

        await this.prisma.attendanceSession.update({
          where: { id: session.id },
          data: { status: 'CLOSED' },
        });
      }

      throw new RpcException({
        statusCode: 400,
        message: 'La asistencia ya está cerrada',
      });
    }

    if (session.status !== 'OPEN') {
      throw new RpcException({
        statusCode: 400,
        message: 'La sesión de asistencia está cerrada',
      });
    }

    const existingAttendance = await this.prisma.attendance.findUnique({
      where: {
        sessionId_participantId: {
          sessionId: data.sessionId,
          participantId: data.participantId,
        },
      },
    });

    if (existingAttendance) {
      throw new RpcException({
        statusCode: 400,
        message: 'El participante ya registró asistencia en esta sesión',
      });
    }

    // Buscamos la reunión correspondiente a esta sesión.
    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: session.meetingId,
      }),
    );

    if (!meeting) {
      throw new RpcException({
        statusCode: 404,
        message: 'La reunión asociada a la sesión no existe',
      });
    }

    const enrollment = await firstValueFrom(
      this.activitiesService.send('find-enrollment', {
        activityId: meeting.activityId,
        participantId: data.participantId,
      }),
    );

    if (!enrollment || enrollment.status !== 'ACTIVE') {
      throw new RpcException({
        statusCode: 400,
        message: 'El participante no está inscripto en esta actividad',
      });
    }

    // Validamos la ubicación del participante.
    const locationValidation = await firstValueFrom(
      this.locationService.send('validate-location', {
        latitude: data.latitude,
        longitude: data.longitude,
        classroomLatitude: Number(meeting.latitude),
        classroomLongitude: Number(meeting.longitude),
        allowedRadius: meeting.allowedRadius,
      }),
    );

    if (!locationValidation.isAllowed) {
      throw new RpcException({
        statusCode: 400,
        message: 'El participante está fuera del radio permitido',
      });
    }

    return this.prisma.attendance.create({
      data: {
        sessionId: data.sessionId,
        participantId: data.participantId,
        latitude: data.latitude,
        longitude: data.longitude,
        checkInTime: now,
        status: 'PRESENT',
      },
    });
  }

  async attendanceHistory(participantId: number) {
    return this.prisma.attendance.findMany({
      where: { participantId },
      include: { session: true },
      orderBy: { checkInTime: 'desc' },
    });
  }

  async processAbsences(sessionId: number) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new RpcException({
        statusCode: 404,
        message: 'La sesión de asistencia no existe',
      });
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: session.meetingId,
      }),
    );

    if (!meeting) {
      throw new RpcException({
        statusCode: 404,
        message: 'La reunión asociada a la sesión no existe',
      });
    }

    // Una reunión suspendida no genera ausencias
    if (meeting.status === 'SUSPENDED') {
      return {
        message: 'La reunión está suspendida. No se registran ausencias.',
      };
    }

    const enrollments = await firstValueFrom(
      this.activitiesService.send('find-active-enrollments', {
        activityId: meeting.activityId,
      }),
    );

    let processed = 0;
    let dropped = 0;

    for (const enrollment of enrollments) {
      const attendance = await this.prisma.attendance.findUnique({
        where: {
          sessionId_participantId: {
            sessionId,
            participantId: enrollment.participantId,
          },
        },
      });

      // Si no tiene asistencia, faltó
      if (!attendance) {
        const updatedEnrollment = await firstValueFrom(
          this.activitiesService.send('register-absence', {
            enrollmentId: enrollment.id,
          }),
        );

        await this.prisma.attendance.create({
          data: {
            sessionId,
            participantId: enrollment.participantId,
            latitude: 0,
            longitude: 0,
            checkInTime: session.endTime,
            status: 'ABSENT',
          },
        });

        processed++;

        if (updatedEnrollment.status === 'DROPPED') {
          dropped++;
        }
      }
    }

    return {
      message: 'Ausencias procesadas correctamente',
      processed,
      dropped,
    };
  }

}