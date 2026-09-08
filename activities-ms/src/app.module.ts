import { Module } from '@nestjs/common';

import { PrismaModule } from './prisma/prisma.module';
import { ActivitiesModule } from './activities/activities.module';

@Module({
  imports: [
    PrismaModule,
    ActivitiesModule,
  ],
})
export class AppModule {}