# Worker FiapX 11SOAT

Microsserviço de processamento assíncrono de vídeos desenvolvido para o Hackathon FIAP 11SOAT 2026. Consome jobs de processamento via RabbitMQ, extrai frames com FFmpeg, compacta os resultados e armazena no AWS S3.

## Visão Geral

```
RabbitMQ (video.processing / batch.video.processing)
      ↓
  Consumer
      ↓
ProcessVideoService
  ├── Download do vídeo (AWS S3)
  ├── Extração de frames (FFmpeg)
  ├── Compactação (ZIP)
  ├── Upload do resultado (AWS S3)
  └── Notificação (RabbitMQ / AWS SES)
```

## Funcionalidades

- **Processamento individual** — consome `video.processing`, processa um vídeo por mensagem e notifica via fila `video.completed`
- **Processamento em lote** — consome `batch.video.processing`, processa múltiplos vídeos de um usuário e envia e-mail de conclusão via AWS SES
- **Dead Letter Queue** — mensagens com falha são encaminhadas para DLQ após esgotamento de retentativas (até 2 tentativas)
- **Health checks** — endpoints para monitoramento, readiness e liveness probes do Kubernetes
- **Logging estruturado** — Pino com suporte opcional ao Elasticsearch

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 20 + TypeScript 5.9 |
| Framework HTTP | Express 5 |
| Fila de mensagens | RabbitMQ (amqplib) |
| Processamento de vídeo | FFmpeg (ffmpeg-static) |
| Armazenamento | AWS S3 (SDK v3) |
| Notificações | AWS SES (SDK v3) |
| Compactação | Archiver |
| Injeção de dependência | TSyringe + reflect-metadata |
| Logging | Pino + pino-elasticsearch |
| Testes | Vitest |

## Estrutura do Projeto

```
src/
├── @types/                  # Tipos e interfaces de domínio
├── application/
│   └── use-cases/           # Casos de uso da aplicação
├── features/
│   ├── ffmpeg/              # Extração de frames com FFmpeg
│   └── process-video/       # Orquestração do pipeline de vídeo
├── infrastructure/
│   ├── broker/              # Consumers e publisher RabbitMQ
│   ├── gateways/            # Integrações externas (S3, FTP)
│   ├── monitoring/          # Logger (Pino + Elasticsearch)
│   ├── notifications/       # Notificações por e-mail (AWS SES)
│   ├── controllers/         # Controllers HTTP
│   └── routes/              # Definição de rotas Express
├── shared/
│   ├── config/              # Configurações compartilhadas (multer)
│   ├── container/           # Container de injeção de dependências
│   └── utils/               # Utilitários (filesystem, zip)
├── tests/                   # Testes unitários (Vitest)
├── main.ts                  # Ponto de entrada da aplicação
├── routes.ts                # Roteamento Express
└── env.ts                   # Carregamento de variáveis de ambiente
```

## Pré-requisitos

- Node.js 20+
- Docker (opcional)
- RabbitMQ acessível
- AWS: conta com S3 e SES configurados

## Configuração

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# Servidor
PORT=3000
NODE_ENV=development

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
VIDEO_PROCESSING_QUEUE=video.processing
VIDEO_COMPLETED_QUEUE=video.completed
BATCH_VIDEO_PROCESSING_QUEUE=batch.video.processing

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_S3_BUCKET=your-bucket-name

# E-mail via AWS SES
EMAIL_ENABLED=true
EMAIL_FROM=noreply@fiapx.com
# Requer e-mail verificado no AWS SES (Console > SES > Verified Identities)

# Elasticsearch (opcional)
ELASTICSEARCH_ENABLED=false
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200

# Logging
LOG_LEVEL=info
```

## Rodando localmente

```bash
npm install
npm run dev
```

## Build e produção

```bash
npm run build
npm start
```

## Docker

```bash
# Build
docker build -t worker-fiapx:latest .

# Run
docker run -p 3000:3000 \
  -e RABBITMQ_URL=amqp://rabbitmq:5672 \
  -e AWS_REGION=us-east-1 \
  -e AWS_ACCESS_KEY_ID=xxx \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  -e AWS_S3_BUCKET=my-bucket \
  -e EMAIL_ENABLED=true \
  -e EMAIL_FROM=noreply@fiapx.com \
  worker-fiapx:latest
```

## Scripts

```bash
npm run dev              # Desenvolvimento com hot reload (tsx watch)
npm run build            # Compila TypeScript → dist/
npm start                # Inicia servidor compilado
npm run lint             # Verifica código com ESLint
npm run lint:fix         # Corrige problemas de lint automaticamente
npm run format           # Formata código com Prettier
npm run test             # Executa todos os testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Relatório de cobertura de testes
```

## Fluxos de Processamento

### A. Processamento Individual (`video.processing`)

**Formato da mensagem consumida:**
```json
{
  "jobId": "uuid",
  "clientId": "uuid",
  "inputUrlStorage": "https://s3-presigned-url/input/video.mp4",
  "outputUrlStorage": "https://s3-presigned-url/output/",
  "framesPerSecond": 1,
  "format": "jpg"
}
```

**Pipeline:**
1. Download do vídeo via URL assinada do S3 → `/input`
2. Extração de frames com FFmpeg baseada em `framesPerSecond`
3. Compactação dos frames em ZIP (`{jobId}_frames_interval_{ms}ms.zip`)
4. Upload do ZIP para o S3
5. Publicação na fila `video.completed`
6. Remoção dos arquivos temporários

**Mensagem de conclusão publicada:**
```json
{
  "jobId": "uuid",
  "status": "COMPLETED",
  "framesExtracted": 120
}
```

---

### B. Processamento em Lote (`batch.video.processing`)

**Formato da mensagem consumida:**
```json
{
  "person": {
    "clientId": "uuid",
    "name": "Nome do Usuário",
    "email": "usuario@example.com"
  },
  "videos": [
    {
      "id": "video-uuid-1",
      "id_processamento": "batch-uuid",
      "framesPerSecond": 15,
      "format": "png",
      "input_url": "s3://bucket/email/batch-id/video-id-1/input/",
      "output_url": "s3://bucket/email/batch-id/video-id-1/output/"
    }
  ]
}
```

**Pipeline:**
1. Para cada vídeo: lista arquivos na pasta `input_url`, baixa e processa com FFmpeg
2. Upload do ZIP de cada vídeo para sua pasta `output_url` no S3
3. Continua processando os demais vídeos mesmo se um falhar
4. Ao concluir, envia e-mail para o usuário via AWS SES

**Estrutura S3 gerada:**
```
s3://bucket/
  └── user@example.com/
      └── batch-uuid/
          ├── video-uuid-1/
          │   ├── input/video1.mp4
          │   └── output/video1_frames_interval_66ms.zip
          └── video-uuid-2/
              ├── input/video2.mp4
              └── output/video2_frames_interval_66ms.zip
```

---

## Endpoints HTTP

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Status básico (sem verificar dependências) |
| GET | `/health/detailed` | Status de S3, RabbitMQ, FFmpeg e Elasticsearch |
| GET | `/health/readiness` | Readiness probe para Kubernetes |
| GET | `/health/liveness` | Liveness probe para Kubernetes |
| POST | `/videos/process` | Upload manual de vídeo (`multipart/form-data`) — uso em dev |

> Em produção, o processamento ocorre exclusivamente via RabbitMQ.

## Testes

O projeto possui 75 testes unitários cobrindo os principais fluxos:

- FFmpeg Service (10 testes)
- Process Video Service (16 testes)
- Process Video Controller (13 testes)
- Multer Config (16 testes)
- File System Utils (20 testes)

```bash
npm run test
npm run test:coverage
```

## Repositórios Relacionados

- **API:** https://github.com/Vineco77/api_fiapX_11soat
- **Auth:** https://github.com/Vineco77/auth_fiapX_11soat

## Licença

ISC

---

**FIAP 11SOAT — Hackathon 2026**
