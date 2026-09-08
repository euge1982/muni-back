import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';

import { LocationService } from './location.service';

@Controller()
export class LocationController {
  constructor(
    private readonly locationService: LocationService,
  ) {}

  @MessagePattern('validate-location')
  validateLocation(data: {
    latitude: number;
    longitude: number;
    classroomLatitude: number;
    classroomLongitude: number;
    allowedRadius: number;
  }) {
    return this.locationService.validateLocation(data);
  }
}