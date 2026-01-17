# Feature Design - Arquitetura por Funcionalidades

Guia para organizar projetos Node.js/TypeScript usando a abordagem de Feature Design.

## O que é Feature Design?

Feature Design é uma arquitetura que organiza o código por **funcionalidades de negócio** ao invés de camadas técnicas. Cada feature é um módulo autossuficiente contendo todos os arquivos necessários para aquela funcionalidade.

**Tradicional (por camadas):**
```
src/
├── controllers/
├── services/
├── repositories/
└── models/
```

**Feature Design (por funcionalidade):**
```
src/
├── features/
│   ├── users/
│   ├── auth/
│   └── orders/
└── shared/
```

## Estrutura de Pastas

```
src/
├── features/
│   ├── users/
│   │   ├── users.controller.ts    # Handlers HTTP
│   │   ├── users.service.ts       # Regras de negócio
│   │   ├── users.repository.ts    # Acesso a dados
│   │   ├── users.routes.ts        # Definição de rotas
│   │   ├── users.types.ts         # Interfaces e tipos
│   │   ├── users.validation.ts    # Schemas de validação
│   │   └── index.ts               # Barrel file (exports)
│   │
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.routes.ts
│   │   ├── auth.types.ts
│   │   └── index.ts
│   │
│   └── orders/
│       └── ...
│
├── shared/
│   ├── middlewares/
│   │   ├── auth.middleware.ts
│   │   └── error.middleware.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── validators.ts
│   ├── database/
│   │   └── connection.ts
│   └── types/
│       └── common.types.ts
│
└── index.ts                       # Entry point
```

## Benefícios

| Aspecto | Vantagem |
|---------|----------|
| **Coesão** | Código relacionado fica junto, fácil de localizar |
| **Manutenção** | Mudanças em uma feature não afetam outras |
| **Escalabilidade** | Times podem trabalhar em features diferentes sem conflitos |
| **Onboarding** | Novos devs entendem o projeto rapidamente |
| **Exclusão** | Remover uma feature = deletar uma pasta |

## Convenções

### Nomenclatura de Arquivos
```
[feature].[tipo].ts

Exemplos:
- users.controller.ts
- users.service.ts
- users.repository.ts
- users.types.ts
```

### Barrel Files (index.ts)
Cada feature exporta apenas o necessário via `index.ts`:

```typescript
// features/users/index.ts
export { usersRoutes } from './users.routes';
export type { User, CreateUserDTO } from './users.types';
```

### Imports
Use path aliases para imports limpos:

```typescript
// tsconfig.json já configurado com @/
import { usersRoutes } from '@/features/users';
import { authMiddleware } from '@/shared/middlewares/auth.middleware';
```

## Exemplo: Criando uma Feature

### 1. Tipos (`users.types.ts`)
```typescript
export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

export interface CreateUserDTO {
  email: string;
  name: string;
  password: string;
}
```

### 2. Repository (`users.repository.ts`)
```typescript
import { User, CreateUserDTO } from './users.types';

export const usersRepository = {
  async findById(id: string): Promise<User | null> {
    // Acesso ao banco de dados
  },

  async create(data: CreateUserDTO): Promise<User> {
    // Inserção no banco
  },
};
```

### 3. Service (`users.service.ts`)
```typescript
import { usersRepository } from './users.repository';
import { CreateUserDTO } from './users.types';

export const usersService = {
  async createUser(data: CreateUserDTO) {
    // Validações e regras de negócio
    return usersRepository.create(data);
  },
};
```

### 4. Controller (`users.controller.ts`)
```typescript
import { Request, Response } from 'express';
import { usersService } from './users.service';

export const usersController = {
  async create(req: Request, res: Response) {
    const user = await usersService.createUser(req.body);
    res.status(201).json(user);
  },
};
```

### 5. Routes (`users.routes.ts`)
```typescript
import { Router } from 'express';
import { usersController } from './users.controller';

export const usersRoutes = Router();

usersRoutes.post('/', usersController.create);
```

### 6. Barrel File (`index.ts`)
```typescript
export { usersRoutes } from './users.routes';
export type { User, CreateUserDTO } from './users.types';
```

## Quando Usar shared/

Use `shared/` para código reutilizado por **múltiplas features**:

- **Middlewares** globais (autenticação, logging, erros)
- **Utils** genéricos (formatação, validação)
- **Database** (conexão, migrations)
- **Types** comuns (paginação, respostas de erro)

> **Regra:** Se algo é usado por apenas uma feature, mantenha dentro da feature.

## Registrando Rotas

```typescript
// src/index.ts
import express from 'express';
import { usersRoutes } from '@/features/users';
import { authRoutes } from '@/features/auth';
import { ordersRoutes } from '@/features/orders';

const app = express();

app.use('/users', usersRoutes);
app.use('/auth', authRoutes);
app.use('/orders', ordersRoutes);
```
