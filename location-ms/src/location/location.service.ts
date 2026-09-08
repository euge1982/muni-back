import { Injectable } from '@nestjs/common';

@Injectable()
export class LocationService {
  validateLocation(data: {
    latitude: number;
    longitude: number;
    classroomLatitude: number;
    classroomLongitude: number;
    allowedRadius: number;
  }) {
    const distance = this.calculateDistance(
      data.latitude,
      data.longitude,
      data.classroomLatitude,
      data.classroomLongitude,
    );

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      classroomLatitude: data.classroomLatitude,
      classroomLongitude: data.classroomLongitude,
      distance,
      isAllowed: distance <= data.allowedRadius,
    };
  }

  private calculateDistance(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number,
  ): number {
    const earthRadius = 6371000;

    const lat1 = this.toRadians(latitude1);
    const lat2 = this.toRadians(latitude2);

    const deltaLatitude = this.toRadians(latitude2 - latitude1);
    const deltaLongitude = this.toRadians(longitude2 - longitude1);

    const a =
      Math.sin(deltaLatitude / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLongitude / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}