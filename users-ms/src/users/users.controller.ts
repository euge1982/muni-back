import { Controller } from '@nestjs/common';
import { MessagePattern } from '@nestjs/microservices';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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

  @MessagePattern('update-user-roles')
  updateRoles(data: { id: number; roles: Role[] }) {
    return this.usersService.updateRoles(data.id, data.roles);
  }

  @MessagePattern('validate-credentials')
validateCredentials(data: { email: string; password: string }) {
  return this.usersService.validateCredentials(
    data.email,
    data.password,
  );
}
}