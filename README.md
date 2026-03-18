# Bridal Backend (NestJS + Prisma + PostgreSQL)

## Project Setup

```bash
# Install dependencies using pnpm
$ pnpm install


# Development mode
$ pnpm run start

# Watch mode (auto-reload on changes)
$ pnpm run start:dev

# Production mode
$ pnpm run start:prod

# Replace <migration_name> with a descriptive name
$ pnpm prisma migrate dev --name <migration_name>


$ pnpm prisma migrate deploy

$ pnpm prisma generate


# Create a new module
$ nest g module modules/auth
$ nest g module modules/users

# Create a new service
$ nest g service modules/users
$ nest g service modules/auth

# Create a new controller
$ nest g controller modules/users
$ nest g controller modules/auth