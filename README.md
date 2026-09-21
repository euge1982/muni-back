# NUESTRO PROYECTO: 

BACKEND DE PAGINA WEB Y APP MUNICIPAL PARA GESTION DE CURSOS, TALLERES Y ENCUENTROS, CON TOMA DE ASISTENCIA POR GEOLOCALIZACION

El sistema está desarrollado con una arquitectura de microservicios utilizando NestJS, Prisma y PostgreSQL.

## Arquitectura

```
                 ┌── Users MS
                 │
Cliente ───────> Gateway ──┬── Activities 
                               MS
                           ├── Attendance 
                            MS
                           └── Location MS
```

## MICROSERVICIOS:

* Gateway: punto de entrada HTTP, autenticación JWT y autorización mediante roles.
* Users MS: gestión de usuarios, credenciales y roles.
* Activities MS: gestión de actividades, reuniones, inscripciones y materiales.
* Attendance MS: gestión de sesiones y registros de asistencia.
* Location MS: validación de ubicación mediante geolocalización.

## TECNOLOGIAS UTILIZADAS:
* NestJS
* Node.js
* PostgreSQL
* Prisma ORM
* JWT
* Passport
* Swagger

## ROLES:
* PARTICIPANTE
* INSTRUCTOR
* ADMINISTRADOR

- Un usuario puede tener más de un rol.
- Los usuarios nuevos se registran como PARTICIPANTE y los roles adicionales son administrados según los permisos correspondientes.

## FUNCIONALIDADES:
* USUARIOS: Registro de usuarios, Inicio de sesión, Autenticación mediante JWT, Gestión de roles.

* ACTIVIDADES: Creación y consulta de actividades, Asignación de responsable, Capacidad de participantes, Período de inscripción, Gestión de reuniones.

* INSCRIPCIONES: Inscripción a actividades, Retiro voluntario, Control de estado de inscripción, Contador de ausencias, Baja automática después de 3 ausencia, Reactivación administrativa.

* ASISTENCIA: Apertura y cierre de sesiones, Registro de asistencia, Validación de ubicación, Control de asistencia duplicada, Procesamiento de ausencias, Historial de asistencia.

* GEOLOCALIZACION: 
- La ubicación del participante se valida utilizando las coordenadas de la reunión y un radio permitido.
- La validación se realiza mediante el microservicio de ubicación.

## REGLAS DE ASISTENCIA:
- La asistencia está disponible dentro de una ventana de 30 minutos a partir del inicio de la reunión.
- El participante:
    * debe estar inscripto en la actividad,
    * debe encontrarse dentro del radio permitido,
    * no puede registrar asistencia más de una vez en la misma sesión.
- Las personas inscriptas que no registran asistencia son procesadas como ausentes.
- Al alcanzar 3 ausencias, la inscripción pasa a estado DROPPED.
- La reactivación de una inscripción dada de baja por ausencias corresponde al administrador.

## PUERTOS:
* Gateway	3000
* Users MS	3001
* Activities MS	3002
* Attendance MS	3003
* Location MS	3004

## INSTALACION:
- Como cada microservicio posee sus propias dependencias, desde cada carpeta ejecutar:
#                      npm install

- Las variables de entorno deben configurarse en los archivos .env correspondientes.

Los archivos .env no se incluyen en el repositorio por contener información sensible.

## EJECUCION:
Por cada servicio abrir una terminal:
* Users MS
#       cd users-ms
#       npm run start:dev
... se repite por cada servicio

- Una vez iniciado el Gateway, la documentación y prueba de la API se encuentran en: http://localhost:3000/api

- Desde Swagger se pueden probar los endpoints HTTP del sistema.

## Endpoints principales
* Autenticación
    - POST /auth/login
* Usuarios
    - GET    /users
    - POST   /users
    - PATCH  /users/:id/roles
* Actividades
    - GET  /activities
    - POST /activities
    - GET  /activities/:id
    - POST /activities/:id/meetings
    - POST /activities/:id/enrollments
    - PATCH /activities/:id/enrollments/withdraw
* Asistencia
    - POST /attendance/open
    - POST /attendance/close
    - POST /attendance/checkin
    - GET  /attendance/history/:participantId
    - POST /attendance/process-absences
* Ubicación
    - POST /location/validate
* Reactivación
    - POST /enrollments/:id/reactivate

## ARQUITECTURA DE DATOS:
- Cada microservicio mantiene su propia responsabilidad y su propia base de datos.
- La comunicación entre microservicios se realiza mediante TCP y el Gateway expone la API HTTP para los clientes.