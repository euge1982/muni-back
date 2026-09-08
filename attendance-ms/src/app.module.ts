import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { AttendanceModule } from './attendance/attendance.module';

@Module({
  imports: [
    PrismaModule,
    AttendanceModule,
  ],
})

export class AppModule {}