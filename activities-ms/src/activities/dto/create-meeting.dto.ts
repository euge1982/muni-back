export class CreateMeetingDto {
  activityId: number;
  dateTime: Date;
  location: string;
  latitude: number;
  longitude: number;
  allowedRadius: number;
}