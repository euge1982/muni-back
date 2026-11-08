
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@ApiTags('Autenticación')
@Controller()
export class AuthController {
  constructor(
    @Inject('USERS_SERVICE')
    private readonly usersService: ClientProxy,
    private readonly authService: AuthService,
  ) {}

  @Post('auth/register')
  @ApiOperation({ summary: 'Registrar un nuevo participante' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'password'],
      properties: {
        firstName: { type: 'string', example: 'Juan' },
        lastName: { type: 'string', example: 'Pérez' },
        email: {
          type: 'string',
          format: 'email',
          example: 'juan@example.com',
        },
        password: {
          type: 'string',
          minLength: 8,
          example: 'ClaveSegura123',
        },
        phone: { type: 'string', example: '2991234567' },
      },
    },
  })
  async registerParticipant(
    @Body()
    data: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      phone?: string;
    },
  ) {
    const firstName = data.firstName?.trim();
    const lastName = data.lastName?.trim();
    const email = data.email?.trim().toLowerCase();
    const password = data.password;
    const phone = data.phone?.trim() || undefined;

    if (!firstName || !lastName || !email || !password) {
      throw new BadRequestException(
        'Nombre, apellido, correo y contraseña son obligatorios',
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException(
        'El correo electrónico no es válido',
      );
    }

    if (password.length < 8) {
      throw new BadRequestException(
        'La contraseña debe tener al menos 8 caracteres',
      );
    }

    return firstValueFrom(
      this.usersService.send('create-user', {
        firstName,
        lastName,
        email,
        password,
        ...(phone && { phone }),
      }),
    );
  }

  @Post('auth/login')
  @ApiOperation({ summary: 'Iniciar Sesion' })
  @ApiBody({
    schema: {
      example: {
        email: 'juan@test.com',
        password: '123456',
      },
    },
  })
  login(@Body() data: { email: string; password: string }) {
    return this.authService.login(data.email, data.password);
  }
}
