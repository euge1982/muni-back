import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject('USERS_SERVICE')
    private readonly usersService: ClientProxy,
  ) { }

  async findAll() {
    return this.prisma.activity.findMany({
      include: {
        meetings: true,
        enrollments: true,
        materials: true,
      },
    });
  }

  async findById(id: number) {
    return this.prisma.activity.findUnique({
      where: { id },
      include: {
        meetings: true,
        enrollments: true,
        materials: true,
      },
    });
  }

  async create(createActivityDto: CreateActivityDto) {
    const responsible = await firstValueFrom(
      this.usersService.send('find-user', {
        userId: createActivityDto.responsibleId,
      }),
    );

    if (!responsible) {
      throw new RpcException({
        statusCode: 404,
        message: 'El responsable indicado no existe',
      });
    }

    if (!responsible.roles.includes('INSTRUCTOR')) {
      throw new RpcException({
        statusCode: 400,
        message: 'El responsable de una actividad debe tener el rol INSTRUCTOR',
      });
    }

    return this.prisma.activity.create({
      data: {
        name: createActivityDto.name,
        description: createActivityDto.description,
        capacity: createActivityDto.capacity,
        enrollmentStart: createActivityDto.enrollmentStart,
        enrollmentEnd: createActivityDto.enrollmentEnd,
        responsibleId: createActivityDto.responsibleId,
      },
    });
  }

  async update(id: number, data: {
    name?: string;
    description?: string | null;
    capacity?: number;
    enrollmentStart?: Date;
    enrollmentEnd?: Date;
    responsibleId?: number;
  }) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad no existe',
      });
    }
    if (activity.status === 'FINISHED') {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede modificar una actividad finalizada. Reactivala primero.',
      });
    }

    const enrollmentStart =
      data.enrollmentStart ?? activity.enrollmentStart;
    const enrollmentEnd =
      data.enrollmentEnd ?? activity.enrollmentEnd;

    if (enrollmentStart >= enrollmentEnd) {
      throw new RpcException({
        statusCode: 400,
        message: 'El inicio de inscripción debe ser anterior al cierre',
      });
    }

    if (data.capacity !== undefined) {
      if (!Number.isInteger(data.capacity) || data.capacity <= 0) {
        throw new RpcException({
          statusCode: 400,
          message: 'La capacidad debe ser un entero mayor que cero',
        });
      }

      const activeEnrollments = await this.prisma.enrollment.count({
        where: { activityId: id, status: 'ACTIVE' },
      });

      if (data.capacity < activeEnrollments) {
        throw new RpcException({
          statusCode: 400,
          message: 'El cupo no puede ser menor que las inscripciones activas',
        });
      }
    }

    if (data.responsibleId !== undefined) {
      const responsible = await firstValueFrom(
        this.usersService.send('find-user', {
          userId: data.responsibleId,
        }),
      );

      if (!responsible) {
        throw new RpcException({
          statusCode: 404,
          message: 'El responsable indicado no existe',
        });
      }

      if (!responsible.roles?.includes('INSTRUCTOR')) {
        throw new RpcException({
          statusCode: 400,
          message: 'El responsable debe tener el rol INSTRUCTOR',
        });
      }
    }

    return this.prisma.activity.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.capacity !== undefined && { capacity: data.capacity }),
        ...(data.enrollmentStart !== undefined && {
          enrollmentStart: data.enrollmentStart,
        }),
        ...(data.enrollmentEnd !== undefined && {
          enrollmentEnd: data.enrollmentEnd,
        }),
        ...(data.responsibleId !== undefined && {
          responsibleId: data.responsibleId,
        }),
      },
    });
  }

  async delete(id: number) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        meetings: { select: { id: true }, take: 1 },
        enrollments: { select: { id: true }, take: 1 },
        materials: { select: { id: true }, take: 1 },
      },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad no existe',
      });
    }

    if (
      activity.meetings.length > 0 ||
      activity.enrollments.length > 0 ||
      activity.materials.length > 0
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'No se puede eliminar una actividad con encuentros, inscripciones o materiales',
      });
    }

    return this.prisma.activity.delete({
      where: { id },
    });
  }

  async finish(id: number) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad no existe',
      });
    }

    if (activity.status === 'FINISHED') {
      throw new RpcException({
        statusCode: 400,
        message: 'La actividad ya está finalizada',
      });
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: 'FINISHED' },
    });
  }

  async reactivate(id: number) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad no existe',
      });
    }

    if (activity.status !== 'FINISHED') {
      throw new RpcException({
        statusCode: 400,
        message: 'Solo se pueden reactivar actividades finalizadas',
      });
    }

    return this.prisma.activity.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }
  async createMeeting(createMeetingDto: CreateMeetingDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: createMeetingDto.activityId },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad indicada no existe',
      });
    }

    if (activity.status !== 'ACTIVE') {
      throw new RpcException({
        statusCode: 400,
        message: 'No se pueden crear encuentros para una actividad finalizada',
      });
    }

    return this.prisma.meeting.create({
      data: {
        activityId: createMeetingDto.activityId,
        dateTime: createMeetingDto.dateTime,
        location: createMeetingDto.location,
        latitude: createMeetingDto.latitude,
        longitude: createMeetingDto.longitude,
        allowedRadius: createMeetingDto.allowedRadius,
      },
    });
  }

  async createEnrollment(createEnrollmentDto: CreateEnrollmentDto) {
    const activity = await this.prisma.activity.findUnique({
      where: { id: createEnrollmentDto.activityId },
    });

    if (!activity) {
      throw new RpcException({
        statusCode: 404,
        message: 'La actividad indicada no existe',
      });
    }

    const participant = await firstValueFrom(
      this.usersService.send('find-user', {
        userId: createEnrollmentDto.participantId,
      }),
    );

    if (!participant) {
      throw new RpcException({
        statusCode: 404,
        message: 'El participante indicado no existe',
      });
    }

    if (!participant.roles.includes('PARTICIPANTE')) {
      throw new RpcException({
        statusCode: 400,
        message: 'El usuario indicado no tiene el rol PARTICIPANTE',
      });
    }

    if (activity.status !== 'ACTIVE') {
      throw new RpcException({
        statusCode: 400,
        message: 'La actividad no está activa',
      });
    }

    const now = new Date();

    if (now < activity.enrollmentStart || now >= activity.enrollmentEnd) {
      throw new RpcException({
        statusCode: 400,
        message: 'La inscripción está fuera del período permitido',
      });
    }

    const existingEnrollment = await this.prisma.enrollment.findUnique({
      where: {
        activityId_participantId: {
          activityId: createEnrollmentDto.activityId,
          participantId: createEnrollmentDto.participantId,
        },
      },
    });

    if (existingEnrollment) {
      if (existingEnrollment.status === 'WITHDRAWN') {
        return this.prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'ACTIVE',
            absenceCount: 0,
          },
        });
      }

      throw new RpcException({
        statusCode: 400,
        message: 'El participante ya está inscripto en esta actividad',
      });
    }

    const activeEnrollments = await this.prisma.enrollment.count({
      where: {
        activityId: createEnrollmentDto.activityId,
        status: 'ACTIVE',
      },
    });

    if (activeEnrollments >= activity.capacity) {
      throw new RpcException({
        statusCode: 400,
        message: 'La actividad no tiene cupos disponibles',
      });
    }

    return this.prisma.enrollment.create({
      data: {
        activityId: createEnrollmentDto.activityId,
        participantId: createEnrollmentDto.participantId,
      },
    });
  }

  async withdrawEnrollment(activityId: number, participantId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: {
        activityId_participantId: {
          activityId,
          participantId,
        },
      },
    });

    if (!enrollment) {
      throw new RpcException({
        statusCode: 404,
        message: 'La inscripción no existe',
      });
    }

    if (enrollment.status !== 'ACTIVE') {
      throw new RpcException({
        statusCode: 400,
        message: 'La inscripción no está activa',
      });
    }

    return this.prisma.enrollment.update({
      where: {
        id: enrollment.id,
      },
      data: {
        status: 'WITHDRAWN',
      },
    });
  }


  async findMeeting(id: number) {
    return this.prisma.meeting.findUnique({
      where: { id },
      include: {
        activity: true,
      },
    });
  }


  async updateMeeting(data: {
    id: number;
    dateTime?: Date;
    location?: string;
    latitude?: number;
    longitude?: number;
    allowedRadius?: number;
    status?: 'SCHEDULED' | 'SUSPENDED' | 'FINISHED';
  }) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: data.id },
      include: {
        activity: true,
      },
    });

    if (!meeting) {
      throw new RpcException({
        statusCode: 404,
        message: 'La reunión no existe',
      });
    }
    if (meeting.activity.status === 'FINISHED') {
      throw new RpcException({
        statusCode: 400,
        message:
          'No se puede modificar un encuentro de una actividad finalizada. Reactivala primero.',
      });
    }

    const updateData = {
      ...(data.dateTime !== undefined && {
        dateTime: data.dateTime,
      }),
      ...(data.location !== undefined && {
        location: data.location,
      }),
      ...(data.latitude !== undefined && {
        latitude: data.latitude,
      }),
      ...(data.longitude !== undefined && {
        longitude: data.longitude,
      }),
      ...(data.allowedRadius !== undefined && {
        allowedRadius: data.allowedRadius,
      }),
      ...(data.status !== undefined && {
        status: data.status,
      }),
    };

    return this.prisma.meeting.update({
      where: { id: data.id },
      data: updateData,
    });
  }

  async findEnrollment(activityId: number, participantId: number) {
    return this.prisma.enrollment.findUnique({
      where: {
        activityId_participantId: {
          activityId,
          participantId,
        },
      },
    });
  }

  async findActiveEnrollments(activityId: number) {
    return this.prisma.enrollment.findMany({
      where: {
        activityId,
        status: 'ACTIVE',
      },
    });
  }

  async findEnrollmentsByParticipant(participantId: number) {
    return this.prisma.enrollment.findMany({
      where: {
        participantId,
      },
      include: {
        activity: {
          include: {
            meetings: true,
          },
        },
      },
      orderBy: {
        enrolledAt: 'desc',
      },
    });
  }
  async registerAbsence(enrollmentId: number, sessionId: number) {
    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
      });

      if (!enrollment) {
        throw new RpcException({
          statusCode: 404,
          message: 'La inscripción no existe',
        });
      }

      const existingAbsence = await tx.processedAbsence.findUnique({
        where: {
          enrollmentId_sessionId: {
            enrollmentId,
            sessionId,
          },
        },
      });

      if (existingAbsence) {
        return enrollment;
      }

      if (enrollment.status !== 'ACTIVE') {
        return enrollment;
      }

      const absenceCount = enrollment.absenceCount + 1;

      await tx.processedAbsence.create({
        data: {
          enrollmentId,
          sessionId,
        },
      });

      return tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          absenceCount,
          status: absenceCount >= 3 ? 'DROPPED' : 'ACTIVE',
        },
      });
    });
  }

  async reactivateEnrollment(enrollmentId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw new RpcException({
        statusCode: 404,
        message: 'La inscripción no existe',
      });
    }

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        status: 'ACTIVE',
        absenceCount: 0,
      },
    });
  }

}