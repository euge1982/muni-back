import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import * as bcrypt from 'bcrypt';
import { Role, UserStatus, Prisma } from '@prisma/client';

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
          status: UserStatus.ACTIVE,
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

  async updateRoles(
    id: number,
    roles: Role[],
    requesterId: number,
  ) {
    // Validar ID
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'El ID del usuario no es válido',
      });
    }

    // Validar roles
    const validRoles = Object.values(Role);

    if (
      !Array.isArray(roles) ||
      !roles.every((role) => validRoles.includes(role))
    ) {
      throw new RpcException({
        statusCode: 400,
        message: 'Los roles indicados no son válidos',
      });
    }

    // El rol PARTICIPANTE es obligatorio
    if (!roles.includes(Role.PARTICIPANTE)) {
      throw new RpcException({
        statusCode: 400,
        message: 'El rol PARTICIPANTE es obligatorio',
      });
    }

    // Buscar usuario que se quiere modificar
    const currentUser = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        roles: true,
      },
    });

    if (!currentUser) {
      throw new RpcException({
        statusCode: 404,
        message: 'Usuario no encontrado',
      });
    }

    // Evitar que un administrador se quite su propio rol
    if (
      id === requesterId &&
      !roles.includes(Role.ADMINISTRADOR)
    ) {
      throw new RpcException({
        statusCode: 403,
        message: 'No podés quitarte tu propio rol de administrador',
      });
    }

    // Evitar quitar el rol al último administrador activo
    if (
      currentUser.roles.includes(Role.ADMINISTRADOR) &&
      !roles.includes(Role.ADMINISTRADOR)
    ) {
      const activeAdmins = await this.prisma.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roles: {
            has: Role.ADMINISTRADOR,
          },
        },
      });

      if (activeAdmins <= 1) {
        throw new RpcException({
          statusCode: 403,
          message: 'No se puede quitar el rol al último administrador activo',
        });
      }
    }

    // Actualizar roles
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { roles },
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
  
  async updateStatus(id: number, status: UserStatus) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new RpcException({
        statusCode: 400,
        message: 'El ID del usuario no es válido',
      });
    }

    const validStatuses = Object.values(UserStatus);

    if (!validStatuses.includes(status)) {
      throw new RpcException({
        statusCode: 400,
        message: 'El estado indicado no es válido',
      });
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: { status },
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

  async validateCredentials(email: string, password: string) {
    const user = await this.findByEmail(email);

    if (!user) {
      return null;
    }

    if (user.status !== UserStatus.ACTIVE) {
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
