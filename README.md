# Worker - Video Processing Service (FIAP 11SOAT)

Serviço worker para processamento de vídeos com extração de frames usando FFmpeg.

## 🎯 Visão Geral

Worker service responsável por:

### Processamento Individual
- Consumir mensagens da fila RabbitMQ (`video.processing`)
- Baixar vídeos do AWS S3 usando URLs assinadas
- Extrair frames com FFmpeg
- Compactar frames em arquivo ZIP
- Upload do ZIP de volta para o S3
- Notificar conclusão via fila RabbitMQ (`video.completed`)

### Processamento em Batch (Novo!)
- Consumir mensagens da fila RabbitMQ (`batch.video.processing`)
- Processar múltiplos vídeos de um mesmo usuário em paralelo
- Baixar vídeos de pastas S3 específicas
- Processar cada vídeo individualmente
- Upload dos ZIPs em pastas S3 individuais por vídeo
- Notificação de conclusão por vídeo

## 🛠️ Stack Tecnológica

- **Runtime:** Node.js >= 18
- **Framework:** Express 5.2.1
- **Linguagem:** TypeScript 5.9.3
- **Queue:** RabbitMQ (amqplib)
- **Storage:** AWS S3
- **Video Processing:** FFmpeg (ffmpeg-static)
- **File Compression:** Archiver
- **DI Container:** TSyringe
- **Testing:** Vitest

## 📁 Estrutura do Projeto

```
src/
├── @types/              # Type definitions
├── features/            # Feature modules
│   ├── ffmpeg/          # FFmpeg service
│   └── process-video/   # Video processing service
├── infrastructure/      # Infrastructure layer
│   ├── broker/          # RabbitMQ integration
│   └── gateways/        # External services (S3)
├── shared/              # Shared utilities
│   ├── config/          # Configuration files
│   ├── container/       # DI container setup
│   └── utils/           # Utility functions
└── tests/               # Unit tests
```

## 🚀 Como Executar

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

**Variáveis obrigatórias:**
```env
# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672
VIDEO_PROCESSING_QUEUE=video.processing
VIDEO_COMPLETED_QUEUE=video.completed

# AWS S3
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name

# Server
PORT=3000
NODE_ENV=development
```

### 3. Executar em desenvolvimento

```bash
npm run dev
```

### 4. Compilar para produção

```bash
npm run build
npm start
```

## 📝 Scripts Disponíveis

```bash
npm run dev            # Executa em modo desenvolvimento (hot reload com tsx)
npm run build          # Compila TypeScript para JavaScript
npm start              # Executa versão compilada
npm run lint           # Verifica código com ESLint
npm run lint:fix       # Corrige automaticamente problemas do ESLint
npm run format         # Formata código com Prettier
npm run test           # Executa testes unitários
npm run test:watch     # Executa testes em modo watch
npm run test:coverage  # Executa testes com cobertura
```

## 🔄 Fluxos de Processamento

### A. Processamento Individual (video.processing)

#### 1. Consumir Mensagem
O worker consome mensagens da fila `video.processing` com o seguinte formato:

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

#### 2. Download do S3
- Usa a URL assinada (`inputUrlStorage`) para baixar o vídeo
- Salva temporariamente em `/input`

#### 3. Extração de Frames
- Processa o vídeo com FFmpeg
- Extrai frames baseado no `framesPerSecond`
- Salva frames em diretório temporário

#### 4. Compactação
- Cria arquivo ZIP com todos os frames
- Nome do arquivo: `{jobId}_frames_interval_{intervalMs}ms.zip`

#### 5. Upload para S3
- Faz upload do ZIP para o S3
- Usa o prefixo especificado em `outputUrlStorage`

#### 6. Notificação
Publica mensagem na fila `video.completed`:

```json
{
  "jobId": "uuid",
  "status": "COMPLETED",
  "framesExtracted": 120
}
```

Em caso de erro:
```json
{
  "jobId": "uuid",
  "status": "FAILED",
  "error": "Error message"
}
```

#### 7. Cleanup
- Remove arquivos temporários
- Libera recursos

---

### B. Processamento em Batch (batch.video.processing)

#### 1. Consumir Mensagem Batch
O worker consome mensagens da fila `batch.video.processing` com o seguinte formato:

```json
{
  "person": {
    "clientId": "uuid",
    "name": "User Name",
    "email": "user@example.com"
  },
  "videos": [
    {
      "id": "video-uuid-1",
      "id_processamento": "batch-uuid",
      "framesPerSecond": 15,
      "format": "png",
      "input_url": "s3://bucket/email/batch-id/video-id-1/input/",
      "output_url": "s3://bucket/email/batch-id/video-id-1/output/"
    },
    {
      "id": "video-uuid-2",
      "id_processamento": "batch-uuid",
      "framesPerSecond": 15,
      "format": "png",
      "input_url": "s3://bucket/email/batch-id/video-id-2/input/",
      "output_url": "s3://bucket/email/batch-id/video-id-2/output/"
    }
  ]
}
```

#### 2. Processar Cada Vídeo
Para cada vídeo no array:
- Lista todos os arquivos de vídeo na pasta `input_url`
- Baixa cada vídeo da pasta S3 do vídeo específico
- Processa individualmente com FFmpeg
- Cria ZIP dos frames de cada vídeo

#### 3. Upload Individual
- Faz upload do ZIP de cada vídeo para sua pasta `output_url` específica
- Mantém separação por vídeo no S3

#### 4. Notificação por Vídeo
- Publica notificação de sucesso/falha para cada vídeo processado
- Continua processando mesmo se um vídeo falhar

#### 5. Limpeza
- Remove arquivos temporários de todos os vídeos
- Libera recursos

**Exemplo de estrutura S3:**
```
s3://bucket/
  └── user@example.com/
      └── batch-uuid/
          ├── video-uuid-1/
          │   ├── input/
          │   │   └── video1.mp4
          │   └── output/
          │       └── video1_frames_interval_66ms.zip
          └── video-uuid-2/
              ├── input/
              │   └── video2.mp4
              └── output/
                  └── video2_frames_interval_66ms.zip
```

---

## 🔌 Integração com S3

O worker utiliza o AWS SDK v3 para:

### Download de Vídeos
```typescript
await s3Gateway.downloadFromUrl({
  url: presignedUrl,
  destinationPath: localPath
});
```

### Upload de Resultados
```typescript
await s3Gateway.uploadFile({
  filePath: zipPath,
  s3Key: 'output/job-123/result.zip',
  contentType: 'application/zip'
});
```

### Operações com URIs S3 (s3://)
```typescript
// Listar arquivos em uma pasta S3
await s3Gateway.listFilesByUri('s3://bucket/folder/');

// Baixar pasta completa do S3
await s3Gateway.downloadFolder(
  's3://bucket/input/',
  './local/folder'
);

// Upload com URI S3
await s3Gateway.uploadFileToUri(
  './local/file.zip',
  's3://bucket/output/',
  'application/zip'
);
```

### Outras Funcionalidades
- `listFiles(prefix)` - Lista arquivos em um prefixo S3
- `downloadByKey(key, dest)` - Download direto por chave S3
- `uploadFromBuffer(buffer, key)` - Upload de buffer
- `parseS3Uri(uri)` - Parse URI s3:// em { bucket, key }

## 🧪 Testes

O projeto possui 75 testes unitários cobrindo:

- ✅ FFmpeg Service (10 testes)
- ✅ Process Video Service (16 testes)
- ✅ Process Video Controller (13 testes)
- ✅ Multer Config (16 testes)
- ✅ File System Utils (20 testes)

**Executar testes:**
```bash
npm run test           # Roda todos os testes
npm run test:watch     # Modo watch
npm run test:coverage  # Com cobertura
```

## 📊 Endpoints HTTP (Desenvolvimento)

Para testes locais, o worker expõe endpoints HTTP:

### Health Check

O worker implementa múltiplos endpoints de health check:

#### 1. Basic Health Check (Load Balancer)
```
GET /health
```
Retorna status simples sem verificar dependências. Ideal para load balancers.

#### 2. Detailed Health Check (Monitoramento)
```
GET /health/detailed
```
Verifica todos os serviços:
- ✅ **S3 (AWS)**: Conectividade, bucket, permissões
- ✅ **RabbitMQ**: Conectividade, filas, mensagens pendentes
- ✅ **Elasticsearch**: Status do cluster (opcional)
- ✅ **FFmpeg**: Instalação, versão

Retorna `200 OK` para healthy/degraded, `503` para unhealthy.

#### 3. Readiness Probe (Kubernetes)
```
GET /health/readiness
```
Verifica se o pod está pronto para receber tráfego.

#### 4. Liveness Probe (Kubernetes)
```
GET /health/liveness
```
Verifica se o processo está vivo (não verifica dependências).

**📖 Documentação completa**: [HEALTH_CHECK.md](docs/HEALTH_CHECK.md)

### Upload Manual de Vídeo
```
POST /videos/process
Content-Type: multipart/form-data

Fields:
- video: arquivo de vídeo
- interval_ms: intervalo entre frames (opcional, padrão: 1000)
- format: formato dos frames (opcional, padrão: jpg)
```

**Nota:** Em produção, o processamento é feito via RabbitMQ, não HTTP.

## 🐳 Docker

```bash
# Build
docker build -t worker-fiapx .

# Run
docker run -p 3000:3000 \
  -e RABBITMQ_URL=amqp://host.docker.internal:5672 \
  -e AWS_S3_BUCKET=my-bucket \
  -e AWS_ACCESS_KEY_ID=xxx \
  -e AWS_SECRET_ACCESS_KEY=xxx \
  worker-fiapx
```

## 📚 Repositórios Relacionados

- **API:** https://github.com/Vineco77/api_fiapX_11soat
- **Auth:** https://github.com/Vineco77/auth_fiapX_11soat

## 📄 Licença

ISC

---

**🚀 FIAP 11SOAT - Hackathon 2026**
