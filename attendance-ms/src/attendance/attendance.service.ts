
import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomBytes } from 'crypto';

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

    if (meeting.status !== 'SCHEDULED') {
      throw new RpcException({
        statusCode: 400,
        message: 'La reunión no está programada',
      });
    }

    const startTime = new Date(meeting.dateTime);
    const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
    const now = new Date();

    if (now < startTime) {
      throw new RpcException({
        statusCode: 400,
        message: 'Todavía no es el horario de apertura de asistencia',
      });
    }

    if (now > endTime) {
      throw new RpcException({
        statusCode: 400,
        message: 'El horario para abrir la asistencia ya finalizó',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(${data.meetingId})
      `;

      const existingSession = await tx.attendanceSession.findFirst({
        where: {
          meetingId: data.meetingId,
          status: 'OPEN',
          endTime: { gte: now },
        },
      });

      if (existingSession) {
        throw new RpcException({
          statusCode: 409,
          message: 'Ya existe una sesión abierta para esta reunión',
        });
      }

      return tx.attendanceSession.create({
        data: {
          meetingId: data.meetingId,
          openedBy: data.openedBy,
          startTime,
          endTime,
          status: 'OPEN',
          absencesProcessed: false,
        },
      });
    });
  }

  async findSession(sessionId: number) {
    return this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });
  }

  async findAttendancesBySession(sessionId: number) {
    return this.prisma.attendance.findMany({
      where: { sessionId },
      orderBy: { participantId: 'asc' },
    });
  }

  async findSessionByMeeting(meetingId: number) {
    const now = new Date();

    const activeSession =
      await this.prisma.attendanceSession.findFirst({
        where: {
          meetingId,
          status: 'OPEN',
          startTime: { lte: now },
          endTime: { gte: now },
        },
        orderBy: { id: 'desc' },
      });

    if (activeSession) {
      return activeSession;
    }

    return this.prisma.attendanceSession.findFirst({
      where: { meetingId },
      orderBy: { id: 'desc' },
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

    if (session.status === 'CLOSED') {
      return session;
    }

    return this.prisma.attendanceSession.update({
      where: { id: session.id },
      data: {
        status: 'CLOSED',
        qrToken: null,
        qrExpiresAt: null,
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
      throw new RpcException({
        statusCode: 400,
        message: 'El horario de asistencia ha finalizado',
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

    if (meeting.status === 'SUSPENDED') {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede registrar asistencia en una reunión suspendida',
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

    if (session.status !== 'CLOSED') {
      throw new RpcException({
        statusCode: 400,
        message: 'La sesión debe estar cerrada para procesar las ausencias',
      });
    }

    if (session.absencesProcessed) {
      throw new RpcException({
        statusCode: 409,
        message: 'Las ausencias de esta sesión ya fueron procesadas',
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

    if (meeting.status === 'SUSPENDED') {
      await this.prisma.attendanceSession.update({
        where: { id: sessionId },
        data: { absencesProcessed: true },
      });

      return {
        message: 'La reunión está suspendida. No se registran ausencias.',
        processed: 0,
        dropped: 0,
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

      if (attendance) {
        if (attendance.status === 'ABSENT') {
          const updatedEnrollment = await firstValueFrom(
            this.activitiesService.send('register-absence', {
              enrollmentId: enrollment.id,
              sessionId,
            }),
          );

          processed++;

          if (updatedEnrollment.status === 'DROPPED') {
            dropped++;
          }
        }

        continue;
      }

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

      const updatedEnrollment = await firstValueFrom(
        this.activitiesService.send('register-absence', {
          enrollmentId: enrollment.id,
          sessionId,
        }),
      );

      processed++;

      if (updatedEnrollment.status === 'DROPPED') {
        dropped++;
      }
    }

    await this.prisma.attendanceSession.update({
      where: { id: sessionId },
      data: { absencesProcessed: true },
    });

    return {
      message: 'Ausencias procesadas correctamente',
      processed,
      dropped,
    };
  }

  async updateManualAttendance(data: {
    sessionId: number;
    participantId: number;
    status: 'PRESENT' | 'ABSENT';
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

    if (session.status !== 'OPEN') {
      throw new RpcException({
        statusCode: 400,
        message: 'La sesión de asistencia está cerrada',
      });
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: session.meetingId,
      }),
    );

    if (!meeting || meeting.status === 'SUSPENDED') {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede modificar la asistencia de esta reunión',
      });
    }

    const enrollment = await firstValueFrom(
      this.activitiesService.send('find-enrollment', {
        activityId: meeting.activityId,
        participantId: data.participantId,
      }),
    );

    if (!enrollment) {
      throw new RpcException({
        statusCode: 404,
        message: 'El participante no está inscripto en esta actividad',
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

    if (existingAttendance?.status === data.status) {
      return existingAttendance;
    }

    if (!existingAttendance && enrollment.status !== 'ACTIVE') {
      throw new RpcException({
        statusCode: 400,
        message: 'El participante no tiene una inscripción activa',
      });
    }

    if (
      existingAttendance?.status === 'ABSENT' &&
      data.status === 'PRESENT'
    ) {
      await firstValueFrom(
        this.activitiesService.send('remove-absence', {
          enrollmentId: enrollment.id,
          sessionId: data.sessionId,
        }),
      );
    }

    if (
      existingAttendance?.status === 'PRESENT' &&
      data.status === 'ABSENT' &&
      session.absencesProcessed
    ) {
      await firstValueFrom(
        this.activitiesService.send('register-absence', {
          enrollmentId: enrollment.id,
          sessionId: data.sessionId,
        }),
      );
    }

    if (existingAttendance) {
      return this.prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          status: data.status,
          latitude: 0,
          longitude: 0,
        },
      });
    }

    const newAttendance = await this.prisma.attendance.create({
      data: {
        sessionId: data.sessionId,
        participantId: data.participantId,
        latitude: 0,
        longitude: 0,
        checkInTime: new Date(),
        status: data.status,
      },
    });

    if (data.status === 'ABSENT' && session.absencesProcessed) {
      await firstValueFrom(
        this.activitiesService.send('register-absence', {
          enrollmentId: enrollment.id,
          sessionId: data.sessionId,
        }),
      );
    }

    return newAttendance;
  }

  // Consulta únicamente el registro del participante solicitado en la sesión.
  async findParticipantAttendance(data: {
    sessionId: number;
    participantId: number;
  }) {
    return this.prisma.attendance.findUnique({
      where: {
        sessionId_participantId: {
          sessionId: data.sessionId,
          participantId: data.participantId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });
  }

  async generateAttendanceQr(sessionId: number) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new RpcException({
        statusCode: 404,
        message: 'La sesión de asistencia no existe',
      });
    }

    const now = new Date();

    if (
      session.status !== 'OPEN' ||
      now < session.startTime ||
      now > session.endTime
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede generar un QR para esta sesión',
      });
    }

    if (
      session.qrToken &&
      session.qrExpiresAt &&
      session.qrExpiresAt > now
    ) {
      return {
        sessionId: session.id,
        token: session.qrToken,
        expiresAt: session.qrExpiresAt,
      };
    }

    const token = randomBytes(32).toString('hex');

    const updatedSession =
      await this.prisma.attendanceSession.update({
        where: { id: sessionId },
        data: {
          qrToken: token,
          qrExpiresAt: session.endTime,
        },
      });

    return {
      sessionId: updatedSession.id,
      token: updatedSession.qrToken,
      expiresAt: updatedSession.qrExpiresAt,
    };
  }

  async registerQrAttendance(data: {
    token: string;
    participantId: number;
  }) {
    const session = await this.prisma.attendanceSession.findUnique({
      where: { qrToken: data.token },
    });

    if (!session) {
      throw new RpcException({
        statusCode: 404,
        message: 'El código QR no es válido',
      });
    }

    const now = new Date();

    if (
      !session.qrExpiresAt ||
      now > session.qrExpiresAt ||
      now < session.startTime ||
      now > session.endTime
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'El código QR venció',
      });
    }

    if (session.status !== 'OPEN') {
      throw new RpcException({
        statusCode: 400,
        message: 'La sesión de asistencia está cerrada',
      });
    }

    const meeting = await firstValueFrom(
      this.activitiesService.send('find-meeting', {
        id: session.meetingId,
      }),
    );

    if (!meeting || meeting.status === 'SUSPENDED') {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede registrar asistencia en esta reunión',
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
        message: 'El participante no tiene una inscripción activa',
      });
    }

    const existingAttendance = await this.prisma.attendance.findUnique({
      where: {
        sessionId_participantId: {
          sessionId: session.id,
          participantId: data.participantId,
        },
      },
    });

    if (existingAttendance) {
      throw new RpcException({
        statusCode: 409,
        message: 'El participante ya registró asistencia en esta sesión',
      });
    }

    return this.prisma.attendance.create({
      data: {
        sessionId: session.id,
        participantId: data.participantId,
        latitude: 0,
        longitude: 0,
        checkInTime: now,
        status: 'PRESENT',
      },
    });
  }
}
