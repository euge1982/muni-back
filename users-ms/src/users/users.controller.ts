import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Role, UserStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @MessagePattern('find-users')
  findAll() {
    return this.usersService.findAll();
  }

  @MessagePattern('find-user')
  findById(data: { userId: number }) {
    return this.usersService.findById(data.userId);
  }

  @MessagePattern('create-user')
  create(createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @MessagePattern('update-user-profile')
  updateProfile(data: {
    userId: number;
    profile: UpdateUserProfileDto;
  }) {
    return this.usersService.updateProfile(
      data.userId,
      data.profile,
    );
  }

  @MessagePattern('update-user-roles')
  updateRoles(data: {
    id: number;
    roles: Role[];
    requesterId: number;
  }) {
    return this.usersService.updateRoles(
      data.id,
      data.roles,
      data.requesterId,
    );
  }

  @MessagePattern('update-user-status')
  updateStatus(data: { id: number; status: UserStatus }) {
    return this.usersService.updateStatus(data.id, data.status);
  }

  @MessagePattern('validate-credentials')
  validateCredentials(data: { email: string; password: string }) {
    return this.usersService.validateCredentials(
      data.email,
      data.password,
    );
  }
}