import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy, RpcException } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

import { PrismaService } from '../prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

const DEFAULT_ALLOWED_RADIUS = 100;

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

    const meetingDate = new Date(createMeetingDto.dateTime);

    if (
      Number.isNaN(meetingDate.getTime()) ||
      meetingDate <= new Date()
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'La fecha y hora del encuentro deben ser futuras',
      });
    }

    const meetingLocation = await this.prisma.meetingLocation.findUnique({
      where: { id: createMeetingDto.locationId },
    });

    if (!meetingLocation || !meetingLocation.isActive) {
      throw new RpcException({
        statusCode: 404,
        message: 'La ubicación seleccionada no existe o está inactiva',
      });
    }

    return this.prisma.meeting.create({
      data: {
        activityId: createMeetingDto.activityId,
        dateTime: createMeetingDto.dateTime,
        location: meetingLocation.name,
        latitude: meetingLocation.latitude,
        longitude: meetingLocation.longitude,
        locationId: meetingLocation.id,
        allowedRadius: DEFAULT_ALLOWED_RADIUS,
      },
    });
  }

  async createMeetingLocation(data: {
    name: string;
    latitude: number;
    longitude: number;
  }) {
    const name = data.name?.trim();

    if (!name) {
      throw new RpcException({
        statusCode: 400,
        message: 'El nombre de la ubicación es obligatorio',
      });
    }

    if (
      !Number.isFinite(data.latitude) ||
      data.latitude < -90 ||
      data.latitude > 90 ||
      !Number.isFinite(data.longitude) ||
      data.longitude < -180 ||
      data.longitude > 180
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Las coordenadas de la ubicación no son válidas',
      });
    }

    const existingLocation = await this.prisma.meetingLocation.findUnique({
      where: { name },
    });

    if (existingLocation) {
      if (existingLocation.isActive) {
        throw new RpcException({
          statusCode: 409,
          message: 'Ya existe una ubicación activa con ese nombre',
        });
      }

      return this.prisma.meetingLocation.update({
        where: { id: existingLocation.id },
        data: {
          latitude: data.latitude,
          longitude: data.longitude,
          isActive: true,
        },
      });
    }

    return this.prisma.meetingLocation.create({
      data: {
        name,
        latitude: data.latitude,
        longitude: data.longitude,
      },
    });
  }
  
  async findMeetingLocations() {
    return this.prisma.meetingLocation.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async deactivateMeetingLocation(id: number) {
    const location = await this.prisma.meetingLocation.findUnique({
      where: { id },
    });

    if (!location) {
      throw new RpcException({
        statusCode: 404,
        message: 'La ubicación indicada no existe',
      });
    }

    if (!location.isActive) {
      throw new RpcException({
        statusCode: 400,
        message: 'La ubicación ya está desactivada',
      });
    }

    return this.prisma.meetingLocation.update({
      where: { id },
      data: { isActive: false },
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
        const activeEnrollments =
          await this.prisma.enrollment.count({
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

        return this.prisma.enrollment.update({
          where: { id: existingEnrollment.id },
          data: {
            status: 'ACTIVE',
            absenceCount: 0,
            enrolledAt: new Date(),
          },
        });
      }

      throw new RpcException({
        statusCode: 400,
        message:
          'El participante ya tiene una inscripción en esta actividad',
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
    locationId?: number;
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
        message: 'El encuentro no existe',
      });
    }

    if (meeting.activity.status === 'FINISHED') {
      throw new RpcException({
        statusCode: 400,
        message:
          'No se puede modificar un encuentro de una actividad finalizada. Reactivala primero.',
      });
    }

    if (
      data.dateTime !== undefined &&
      (Number.isNaN(new Date(data.dateTime).getTime()) ||
        new Date(data.dateTime) <= new Date())
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'La fecha y hora del encuentro deben ser futuras',
      });
    }

    let meetingLocation;

    if (data.locationId !== undefined) {
      meetingLocation = await this.prisma.meetingLocation.findUnique({
        where: { id: data.locationId },
      });

      if (!meetingLocation || !meetingLocation.isActive) {
        throw new RpcException({
          statusCode: 404,
          message: 'La ubicación seleccionada no existe o está inactiva',
        });
      }
    }

    return this.prisma.meeting.update({
      where: { id: data.id },
      data: {
        ...(data.dateTime !== undefined && {
          dateTime: new Date(data.dateTime),
        }),
        ...(meetingLocation && {
          location: meetingLocation.name,
          latitude: meetingLocation.latitude,
          longitude: meetingLocation.longitude,
          locationId: meetingLocation.id,
        }),
        ...(data.status !== undefined && {
          status: data.status,
        }),
      },
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

  async findAllEnrollmentsByActivity(activityId: number) {
    return this.prisma.enrollment.findMany({
      where: { activityId },
      orderBy: {
        enrolledAt: 'asc',
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
          dropReason: absenceCount >= 3 ? 'ABSENCES' : null,
        },
      });
    });
  }

  async removeAbsence(enrollmentId: number, sessionId: number) {
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

      if (!existingAbsence) {
        return enrollment;
      }

      await tx.processedAbsence.delete({
        where: {
          enrollmentId_sessionId: {
            enrollmentId,
            sessionId,
          },
        },
      });

      const absenceCount = Math.max(0, enrollment.absenceCount - 1);

      const shouldReactivate =
        enrollment.status === 'DROPPED' &&
        enrollment.dropReason === 'ABSENCES' &&
        absenceCount < 3;

      return tx.enrollment.update({
        where: { id: enrollmentId },
        data: {
          absenceCount,
          status: shouldReactivate ? 'ACTIVE' : enrollment.status,
          dropReason: shouldReactivate ? null : enrollment.dropReason,
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