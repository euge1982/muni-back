import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import * as bcrypt from 'bcrypt';
import { Role, Prisma } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async findAll() {
    const users = await this.prisma.user.findMany();

    return users.map(({ password, ...user }) => user);
  }

  async findById(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return null;
    }

    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async create(createUserDto: CreateUserDto) {
    const hashedPassword = await bcrypt.hash(
      createUserDto.password,
      10,
    );

    try {
      const user = await this.prisma.user.create({
        data: {
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          email: createUserDto.email,
          password: hashedPassword,
          phone: createUserDto.phone,
          status: 'ACTIVE',
        },
      });

      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new RpcException({
          statusCode: 409,
          message: 'El email ya está registrado',
        });
      }

      throw error;
    }
  }
  async updateProfile(
    id: number,
    profile: UpdateUserProfileDto,
  ) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'El ID del usuario no es válido',
      });
    }

    const data: Prisma.UserUpdateInput = {};

    if (profile.firstName !== undefined) {
      data.firstName = profile.firstName;
    }

    if (profile.lastName !== undefined) {
      data.lastName = profile.lastName;
    }

    if (profile.phone !== undefined) {
      data.phone = profile.phone;
    }

    if (Object.keys(data).length === 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'No se recibieron datos para actualizar',
      });
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data,
      });

      const { password, ...userWithoutPassword } = user;

      return userWithoutPassword;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new RpcException({
          statusCode: 404,
          message: 'El usuario no existe',
        });
      }

      throw error;
    }
  }

  async updateRoles(id: number, roles: Role[]) {
    if (!roles.includes(Role.PARTICIPANTE)) {
      throw new RpcException(
        'El rol PARTICIPANTE es obligatorio',
      );
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: {
        roles,
      },
    });

    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordValid) {
      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      status: user.status,
      roles: user.roles,
    };
  }
}
