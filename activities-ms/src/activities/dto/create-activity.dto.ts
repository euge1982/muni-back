export class CreateActivityDto {
  name: string;
  description?: string;
  capacity: number;
  enrollmentStart: Date;
  enrollmentEnd: Date;
  responsibleId: number;
}