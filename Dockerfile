# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm ci

# Copiar código fonte
COPY tsconfig.json ./
COPY src ./src

# Compilar TypeScript
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Instalar ffmpeg (necessário para processamento de vídeo)
RUN apk add --no-cache ffmpeg

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production

# Copiar código compilado do stage anterior
COPY --from=builder /app/dist ./dist

# Criar diretórios de input/output
RUN mkdir -p /app/input /app/output

# Expor porta
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Comando para iniciar a aplicação
CMD ["node", "dist/main.js"]
