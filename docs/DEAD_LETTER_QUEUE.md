# Sistema de Dead Letter Queue (DLQ) e Notificações por E-mail

## Visão Geral

O sistema implementa um mecanismo robusto de retry e notificação usando Dead Letter Queue (DLQ) do RabbitMQ. Quando um vídeo falha ao processar, o sistema automaticamente tenta reprocessar até 2 vezes. Se todas as tentativas falharem, uma notificação por e-mail é enviada automaticamente para o usuário.

## Arquitetura

```
┌─────────────────┐
│   API Service   │
│  (Publica msg)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│      RabbitMQ - Fila Principal          │
│  video.processing / batch.processing    │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Worker Consumer │◄─── Tentativa 1
│   (Processa)    │
└────────┬────────┘
         │
         ├─── ✅ SUCESSO → ACK → Envia e-mail de sucesso
         │
         └─── ❌ ERRO → NACK com requeue
                 │
                 ▼
         ┌──────────────────┐
         │ Retry Count < 2? │
         └───┬──────────┬───┘
             │          │
          SIM│          │NÃO
             │          │
             ▼          ▼
      ┌─────────┐  ┌──────────────────┐
      │ Requeue │  │ Dead Letter Exch │
      │ +1 retry│  │    (DLX)         │
      └─────────┘  └────────┬─────────┘
                            │
                            ▼
                   ┌─────────────────────┐
                   │ Dead Letter Queue   │
                   │      (DLQ)          │
                   └──────────┬──────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  DLQ Consumer        │
                   │  (Envia e-mail erro) │
                   └──────────────────────┘
```

## Configuração

### 1. Variáveis de Ambiente

Adicione as seguintes variáveis no `.env`:

```bash
# Email Notifications (AWS SES)
EMAIL_ENABLED=true
EMAIL_FROM=noreply@fiapx.com

# AWS Credentials (mesmas usadas para S3)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
```

### 2. Configurar AWS SES

**IMPORTANTE**: Antes de usar o sistema de e-mail em produção:

1. Acesse o AWS Console → Amazon SES
2. Vá para "Verified Identities"
3. Clique em "Create Identity"
4. Verifique o domínio ou e-mail que será usado no `EMAIL_FROM`
5. AWS enviará um e-mail de verificação
6. Clique no link para confirmar

**Ambiente Sandbox (desenvolvimento)**:
- Por padrão, SES opera em modo sandbox
- Só pode enviar para e-mails verificados
- Limite de 200 e-mails/dia

**Ambiente Produção**:
- Solicite saída do sandbox na AWS Console
- Poderá enviar para qualquer e-mail
- Limite muito maior

## Funcionamento

### Tentativas de Retry

1. **Primeira tentativa**: Worker processa a mensagem
2. **Se falhar**: Mensagem volta para fila com header `x-retry-count: 1`
3. **Segunda tentativa**: Worker tenta novamente
4. **Se falhar novamente**: Mensagem volta com `x-retry-count: 2`
5. **Após 2 falhas**: Mensagem vai para Dead Letter Queue

### Dead Letter Queue (DLQ)

Quando uma mensagem atinge o limite de retries:

1. RabbitMQ move para `video.processing.dlq`
2. DLQ Consumer lê a mensagem
3. Extrai dados do usuário (nome, e-mail) do payload
4. Envia e-mail de notificação de falha
5. ACK na mensagem da DLQ

### Tipos de E-mail

#### 1. E-mail de Sucesso

Enviado quando o processamento completa com sucesso.

**Trigger**: Após processar todos os frames e fazer upload do ZIP

**Conteúdo**:
- Nome do usuário
- ID do vídeo
- Nome do arquivo
- Quantidade de frames extraídos
- Tempo de processamento

#### 2. E-mail de Falha

Enviado após 2 tentativas falhadas.

**Trigger**: Mensagem cai na DLQ

**Conteúdo**:
- Nome do usuário
- ID do vídeo
- Nome do arquivo
- Descrição do erro
- Número de tentativas (2)
- Sugestões de solução

## Estrutura de Código

### Arquivos Criados

```
src/
├── infrastructure/
│   ├── broker/
│   │   ├── dead-letter.consumer.ts       # Consumer da DLQ
│   │   └── broker.gateway.ts             # Configuração DLX/DLQ
│   │
│   └── notifications/
│       ├── email.service.ts               # Serviço AWS SES
│       ├── email.service.interface.ts     # Interface
│       ├── email-templates.ts             # Templates HTML
│       └── index.ts                       # Exports
```

### Principais Componentes

#### 1. EmailService (`email.service.ts`)

```typescript
interface IEmailService {
  sendEmail(options: SendEmailOptions): Promise<void>;
  sendProcessingFailed(to: string, data: ProcessingFailedEmailData): Promise<void>;
  sendProcessingCompleted(to: string, data: ProcessingCompletedEmailData): Promise<void>;
}
```

#### 2. Dead Letter Consumer (`dead-letter.consumer.ts`)

- Consome mensagens da DLQ
- Processa batch e individual
- Envia e-mail com detalhes do erro
- ACK após envio

#### 3. Broker Gateway (`broker.gateway.ts`)

- Cria Dead Letter Exchange (DLX)
- Cria Dead Letter Queue (DLQ)
- Configura filas principais com DLX

## Payload Esperado

### Batch Processing (com person)

```json
{
  "person": {
    "clientId": "client-123",
    "name": "João Silva",
    "email": "joao@example.com"
  },
  "videos": [
    {
      "id": "video-1",
      "id_processamento": "proc-1",
      "framesPerSecond": 2,
      "format": "jpg",
      "input_url": "s3://bucket/input/",
      "output_url": "s3://bucket/output/"
    }
  ]
}
```

**✅ E-mail disponível**: Sim, em `person.email`

### Individual Processing

```json
{
  "jobId": "job-123",
  "clientId": "client-123",
  "inputUrlStorage": "https://s3.../video.mp4",
  "outputUrlStorage": "s3://bucket/output/",
  "framesPerSecond": 2,
  "format": "jpg"
}
```

**⚠️ E-mail não disponível**: Precisa buscar no banco de dados usando `clientId`

## Logs e Monitoramento

### Logs Estruturados (Elasticsearch)

Todos os eventos são logados com metadata:

```json
{
  "type": "dlq.message.received",
  "retryCount": 2,
  "routingKey": "failed",
  "timestamp": "2026-02-17T..."
}
```

### Tipos de Log

- `dlq.consumer.starting` - DLQ consumer iniciado
- `dlq.message.received` - Mensagem recebida na DLQ
- `dlq.batch.failure` - Falha em batch processing
- `dlq.batch.notification-sent` - E-mail de falha enviado
- `email.sending` - E-mail sendo enviado
- `email.sent` - E-mail enviado com sucesso

### Queries Úteis (Kibana)

```
# Ver todas as mensagens que falharam
type:"dlq.batch.failure"

# Ver e-mails enviados
type:"email.sent"

# Ver erros de e-mail
type:"error" AND context:"EmailService"
```

## Testes

### Testar DLQ Localmente

1. **Publicar mensagem inválida** (vai falhar e ir para DLQ):

```bash
# Publicar via RabbitMQ Management UI
# Queue: batch.video.processing
# Payload: { "invalid": "data" }
```

2. **Verificar logs**:

```bash
# Ver se chegou na DLQ
docker logs worker-container | grep "dlq.message.received"

# Ver se e-mail foi enviado
docker logs worker-container | grep "email.sent"
```

3. **Verificar RabbitMQ Management**:
- Acesse http://localhost:15672
- Queue: `video.processing.dlq`
- Deve estar vazia (consumida)

### Testar E-mail em Desenvolvimento

**Opção 1: Desabilitar e-mail**
```bash
EMAIL_ENABLED=false
```

**Opção 2: Usar e-mail de teste verificado**
```bash
EMAIL_ENABLED=true
EMAIL_FROM=seu-email-verificado@gmail.com
# Enviar apenas para e-mails verificados no SES
```

## Troubleshooting

### E-mail não está sendo enviado

1. **Verificar se está habilitado**:
```bash
echo $EMAIL_ENABLED  # deve ser "true"
```

2. **Verificar credenciais AWS**:
```bash
aws ses verify-email-identity --email-address noreply@fiapx.com
```

3. **Verificar logs**:
```bash
docker logs worker | grep "email"
```

4. **Verificar SES no sandbox**:
- Se sim, apenas e-mails verificados receberão

### Mensagens não vão para DLQ

1. **Verificar configuração da fila**:
```bash
# No RabbitMQ Management UI
# Queue > Arguments deve ter:
# x-dead-letter-exchange: video.processing.dlx
# x-dead-letter-routing-key: failed
```

2. **Verificar retry count**:
- Mensagens só vão para DLQ após 2 retries

3. **Verificar logs**:
```bash
docker logs worker | grep "retry"
```

### Mensagens ficam na DLQ

1. **Consumer não está rodando**:
```bash
docker logs worker | grep "dlq.consumer.started"
```

2. **Erro ao processar DLQ**:
```bash
docker logs worker | grep "DLQ.Consumer"
```

## Custos AWS SES

### Free Tier
- 62.000 e-mails/mês GRÁTIS (quando enviado de EC2)
- Primeiros 1.000 e-mails recebidos GRÁTIS

### Após Free Tier
- $0.10 por 1.000 e-mails enviados
- $0.12 por GB de anexos

### Exemplo de Custo
- 100.000 vídeos processados/mês
- 5% taxa de erro = 5.000 e-mails de falha
- 95.000 e-mails de sucesso
- **Total**: 100.000 e-mails
- **Custo**: GRÁTIS (dentro do free tier)

## Próximos Passos

### Melhorias Futuras

1. **E-mail HTML responsivo**
   - Melhorar templates
   - Adicionar logo da empresa
   - Botões de ação (CTA)

2. **Notificações adicionais**
   - SMS via AWS SNS
   - Push notifications
   - Webhooks

3. **Dashboard de métricas**
   - Taxa de sucesso/falha
   - Tempo médio de processamento
   - E-mails enviados

4. **Retry inteligente**
   - Backoff exponencial
   - Retry apenas para erros recuperáveis
   - Skip para erros permanentes

## Referências

- [RabbitMQ Dead Letter Exchanges](https://www.rabbitmq.com/dlx.html)
- [AWS SES Documentation](https://docs.aws.amazon.com/ses/)
- [AWS SDK for JavaScript v3 - SES](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-ses/)
