import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';

@Controller()
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
  ) { }

  @MessagePattern('find-activities')
  findAll() {
    return this.activitiesService.findAll();
  }

  @MessagePattern('find-activity')
  findById(data: { id: number }) {
    return this.activitiesService.findById(data.id);
  }

  @MessagePattern('create-activity')
  create(createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(createActivityDto);
  }

  @MessagePattern('create-meeting')
  createMeeting(createMeetingDto: CreateMeetingDto) {
    return this.activitiesService.createMeeting(createMeetingDto);
  }

  @MessagePattern('find-meeting')
  findMeeting(data: { id: number }) {
    return this.activitiesService.findMeeting(data.id);
  }

  @MessagePattern('update-meeting')
  updateMeeting(data: {
    id: number;
    dateTime?: Date;
    location?: string;
    latitude?: number;
    longitude?: number;
    allowedRadius?: number;
    status?: 'SCHEDULED' | 'SUSPENDED' | 'FINISHED';
  }) {
    return this.activitiesService.updateMeeting(data);
  }

  @MessagePattern('create-enrollment')
  createEnrollment(createEnrollmentDto: CreateEnrollmentDto) {
    return this.activitiesService.createEnrollment(createEnrollmentDto);
  }

  @MessagePattern('withdraw-enrollment')
  withdrawEnrollment(data: { activityId: number; participantId: number }) {
    return this.activitiesService.withdrawEnrollment(
      data.activityId,
      data.participantId,
    );
  }

  @MessagePattern('find-enrollment')
  findEnrollment(data: { activityId: number; participantId: number }) {
    return this.activitiesService.findEnrollment(
      data.activityId,
      data.participantId,
    );
  }

  @MessagePattern('find-active-enrollments')
  findActiveEnrollments(data: { activityId: number }) {
    return this.activitiesService.findActiveEnrollments(data.activityId);
  }

  @MessagePattern('find-enrollments-by-participant')
  findEnrollmentsByParticipant(data: { participantId: number }) {
    return this.activitiesService.findEnrollmentsByParticipant(
      data.participantId,
    );
  }

  @MessagePattern('reactivate-enrollment')
  reactivateEnrollment(data: { enrollmentId: number }) {
    return this.activitiesService.reactivateEnrollment(data.enrollmentId);
  }

  @MessagePattern('register-absence')
  registerAbsence(data: { enrollmentId: number }) {
    return this.activitiesService.registerAbsence(data.enrollmentId);
  }

}