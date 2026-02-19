# Health Check - Worker Service

## Visão Geral

O Worker Service implementa múltiplos endpoints de health check para monitoramento, orquestração e observabilidade. Cada endpoint serve um propósito específico e verifica diferentes aspectos da saúde do serviço.

## Endpoints Disponíveis

### 1. Basic Health Check

```
GET /health
```

**Propósito**: Verificação rápida e leve do status do serviço.

**Uso**: Load balancers, quick checks, status geral.

**Resposta Rápida**: Não verifica dependências externas.

**Exemplo de Resposta** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "service": "worker-fiapx-11soat",
  "uptime": 3600.5,
  "environment": "production"
}
```

**HTTP Status Codes**:
- `200 OK`: Serviço está rodando

---

### 2. Detailed Health Check

```
GET /health/detailed
```

**Propósito**: Verificação completa de todos os serviços e dependências.

**Verifica**:
- ✅ **S3 (AWS)**: Conectividade, bucket configurado, permissões
- ✅ **RabbitMQ**: Conectividade, filas configuradas, mensagens pendentes
- ✅ **Elasticsearch**: Conectividade, status do cluster (opcional)
- ✅ **FFmpeg**: Instalação, versão disponível

**Exemplo de Resposta** (200 OK - Healthy):
```json
{
  "status": "healthy",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "services": {
    "s3": {
      "status": "ok",
      "responseTime": 145,
      "details": {
        "bucket": "fiapx-storage-78a916d3",
        "bucketExists": true,
        "region": "us-east-1"
      }
    },
    "rabbitmq": {
      "status": "ok",
      "responseTime": 89,
      "details": {
        "queues": {
          "video": {
            "name": "video.processing",
            "exists": true,
            "messages": 5
          },
          "batch": {
            "name": "batch.video.processing",
            "exists": true,
            "messages": 2
          },
          "dlq": {
            "name": "video.processing.dlq",
            "exists": true,
            "messages": 0
          }
        }
      }
    },
    "elasticsearch": {
      "status": "ok",
      "responseTime": 23,
      "details": {
        "clusterName": "docker-cluster",
        "clusterStatus": "green",
        "numberOfNodes": 1,
        "activeShards": 5
      }
    },
    "ffmpeg": {
      "status": "ok",
      "responseTime": 67,
      "details": {
        "version": "6.0",
        "available": true
      }
    }
  },
  "uptime": 3600.5,
  "version": "1.0.0",
  "environment": "production"
}
```

**Exemplo de Resposta** (200 OK - Degraded):
```json
{
  "status": "degraded",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "services": {
    "s3": {
      "status": "ok",
      "responseTime": 145
    },
    "rabbitmq": {
      "status": "ok",
      "responseTime": 89
    },
    "elasticsearch": {
      "status": "error",
      "error": "Connection timeout",
      "details": {
        "host": "localhost",
        "port": "9200"
      }
    },
    "ffmpeg": {
      "status": "ok",
      "responseTime": 67
    }
  },
  "uptime": 3600.5,
  "version": "1.0.0",
  "environment": "production"
}
```

**Exemplo de Resposta** (503 Service Unavailable - Unhealthy):
```json
{
  "status": "unhealthy",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "services": {
    "s3": {
      "status": "error",
      "error": "CredentialsProviderError: Could not load credentials",
      "details": {
        "bucket": "fiapx-storage-78a916d3",
        "region": "us-east-1"
      }
    },
    "rabbitmq": {
      "status": "error",
      "error": "ECONNREFUSED"
    },
    "elasticsearch": {
      "status": "disabled",
      "details": {
        "enabled": false,
        "reason": "ELASTICSEARCH_ENABLED is not set to true"
      }
    },
    "ffmpeg": {
      "status": "ok",
      "responseTime": 67
    }
  },
  "uptime": 3600.5,
  "version": "1.0.0",
  "environment": "production"
}
```

**HTTP Status Codes**:
- `200 OK`: Healthy ou Degraded (serviços críticos ok)
- `503 Service Unavailable`: Unhealthy (serviços críticos com erro)

**Status do Sistema**:
- **healthy**: Todos os serviços estão funcionando
- **degraded**: Serviços opcionais com problema (ex: Elasticsearch)
- **unhealthy**: Serviços críticos com problema (S3, RabbitMQ, FFmpeg)

---

### 3. Readiness Probe

```
GET /health/readiness
```

**Propósito**: Kubernetes readiness probe - determina se o pod está pronto para receber tráfego.

**Verifica**: Serviços **críticos** apenas (S3, RabbitMQ, FFmpeg).

**Uso**: Kubernetes readiness probe, load balancer registration.

**Exemplo de Resposta** (200 OK - Ready):
```json
{
  "status": "ready",
  "timestamp": "2026-02-18T01:30:00.000Z"
}
```

**Exemplo de Resposta** (503 Service Unavailable - Not Ready):
```json
{
  "status": "not-ready",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "services": {
    "s3": {
      "status": "error",
      "error": "Connection timeout"
    },
    "rabbitmq": {
      "status": "ok"
    },
    "elasticsearch": {
      "status": "ok"
    },
    "ffmpeg": {
      "status": "ok"
    }
  }
}
```

**HTTP Status Codes**:
- `200 OK`: Ready (S3, RabbitMQ e FFmpeg funcionando)
- `503 Service Unavailable`: Not Ready (algum serviço crítico com erro)

---

### 4. Liveness Probe

```
GET /health/liveness
```

**Propósito**: Kubernetes liveness probe - determina se o pod deve ser reiniciado.

**Verifica**: Apenas se o processo está vivo (não verifica dependências).

**Uso**: Kubernetes liveness probe.

**Exemplo de Resposta** (200 OK):
```json
{
  "status": "alive",
  "timestamp": "2026-02-18T01:30:00.000Z",
  "uptime": 3600.5
}
```

**HTTP Status Codes**:
- `200 OK`: Processo está vivo

---

## Serviços Verificados

### S3 (AWS) - **CRÍTICO**

**O que verifica**:
- Conectividade com AWS S3
- Lista de buckets acessíveis
- Bucket configurado existe
- Permissões de acesso

**Configuração necessária**:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET=fiapx-storage-xxx
```

**Possíveis erros**:
- `CredentialsProviderError`: Credenciais AWS inválidas
- `AccessDenied`: Sem permissão para listar buckets
- `NoSuchBucket`: Bucket não existe
- `NetworkingError`: Problema de rede/conectividade

---

### RabbitMQ - **CRÍTICO**

**O que verifica**:
- Conectividade com RabbitMQ
- Filas existem e estão configuradas
- Número de mensagens em cada fila
- Dead Letter Queue (DLQ) configurada

**Configuração necessária**:
```bash
RABBITMQ_URL=amqp://guest:guest@localhost:5672
VIDEO_PROCESSING_QUEUE=video.processing
BATCH_VIDEO_PROCESSING_QUEUE=batch.video.processing
```

**Possíveis erros**:
- `ECONNREFUSED`: RabbitMQ não está rodando
- `ACCESS_REFUSED`: Credenciais inválidas
- `NOT_FOUND`: Fila não existe
- `CHANNEL_ERROR`: Problema ao criar canal

---

### Elasticsearch - **OPCIONAL**

**O que verifica**:
- Conectividade com cluster Elasticsearch
- Status do cluster (green, yellow, red)
- Número de nodes ativos
- Active shards

**Configuração necessária**:
```bash
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_HOST=localhost
ELASTICSEARCH_PORT=9200
```

**Status**:
- `disabled`: Quando `ELASTICSEARCH_ENABLED != true`
- `ok`: Cluster está saudável
- `error`: Problema de conectividade ou cluster

**Possíveis erros**:
- `ConnectionError`: Elasticsearch não está rodando
- `TimeoutError`: Timeout na conexão
- Cluster status: `red` (cluster com problema)

---

### FFmpeg - **CRÍTICO**

**O que verifica**:
- FFmpeg instalado no sistema
- Versão do FFmpeg disponível
- Comando executável

**Instalação**:
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Docker
FROM node:18-alpine
RUN apk add --no-cache ffmpeg
```

**Possíveis erros**:
- `FFmpeg not found or not executable`: FFmpeg não instalado
- `ENOENT`: Comando não encontrado no PATH

---

## Uso com Kubernetes

### Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-fiapx
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: worker
          image: vineco/worker-fiapx-11soat:v1.0.0
          ports:
            - containerPort: 3000

          # Liveness Probe - reinicia se não responder
          livenessProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3

          # Readiness Probe - remove do load balancer se não estiver pronto
          readinessProbe:
            httpGet:
              path: /health/readiness
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3

          # Startup Probe - aguarda inicialização completa
          startupProbe:
            httpGet:
              path: /health/liveness
              port: 3000
            initialDelaySeconds: 0
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 30
```

---

## Monitoramento

### Prometheus Metrics (Futuro)

Exemplo de métricas que podem ser expostas:

```
# HELP worker_health_check_duration_seconds Duration of health check
# TYPE worker_health_check_duration_seconds histogram
worker_health_check_duration_seconds{service="s3"} 0.145

# HELP worker_service_status Status of each service (1=ok, 0=error)
# TYPE worker_service_status gauge
worker_service_status{service="s3"} 1
worker_service_status{service="rabbitmq"} 1
worker_service_status{service="elasticsearch"} 0
worker_service_status{service="ffmpeg"} 1

# HELP worker_rabbitmq_queue_messages Number of messages in queue
# TYPE worker_rabbitmq_queue_messages gauge
worker_rabbitmq_queue_messages{queue="video.processing"} 5
worker_rabbitmq_queue_messages{queue="batch.video.processing"} 2
worker_rabbitmq_queue_messages{queue="video.processing.dlq"} 0
```

---

## Logs Estruturados

Todos os health checks geram logs estruturados no Elasticsearch:

```json
{
  "level": "info",
  "type": "health.result",
  "status": "healthy",
  "services": {
    "s3": "ok",
    "rabbitmq": "ok",
    "elasticsearch": "ok",
    "ffmpeg": "ok"
  },
  "timestamp": "2026-02-18T01:30:00.000Z",
  "msg": "Health check completed: healthy"
}
```

**Kibana Queries**:

```
# Ver todos os health checks
type:"health.result"

# Ver health checks com problemas
type:"health.result" AND status:("degraded" OR "unhealthy")

# Ver erros de serviços específicos
type:"health.result" AND services.s3:"error"
```

---

## Troubleshooting

### Health check retorna "unhealthy"

1. **Verificar logs**:
```bash
docker logs worker-container | grep "health"
```

2. **Testar serviços individualmente**:
```bash
# S3
aws s3 ls s3://your-bucket

# RabbitMQ
curl http://localhost:15672/api/overview

# Elasticsearch
curl http://localhost:9200/_cluster/health

# FFmpeg
ffmpeg -version
```

3. **Verificar variáveis de ambiente**:
```bash
env | grep -E "(AWS|RABBITMQ|ELASTICSEARCH)"
```

### Health check lento (>5 segundos)

- S3 pode estar lento: Verificar região e latência de rede
- RabbitMQ com muitas mensagens: Normal mostrar na resposta
- Elasticsearch timeout: Aumentar timeout ou verificar cluster

### Readiness probe failing constantemente

- Pod nunca fica "Ready" no Kubernetes
- Verificar se todos os serviços críticos estão acessíveis
- Aumentar `initialDelaySeconds` se a inicialização for lenta

---

## Exemplos de Uso

### cURL

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health check
curl http://localhost:3000/health/detailed | jq

# Readiness probe
curl http://localhost:3000/health/readiness

# Liveness probe
curl http://localhost:3000/health/liveness
```

### Script de Monitoramento

```bash
#!/bin/bash

WORKER_URL="http://localhost:3000"

while true; do
  STATUS=$(curl -s "$WORKER_URL/health/detailed" | jq -r '.status')

  if [ "$STATUS" = "unhealthy" ]; then
    echo "[ALERT] Worker is unhealthy!"
    # Enviar notificação
  elif [ "$STATUS" = "degraded" ]; then
    echo "[WARNING] Worker is degraded"
  else
    echo "[OK] Worker is healthy"
  fi

  sleep 30
done
```

---

## Próximos Passos

1. **Metrics Endpoint**: Adicionar `/metrics` para Prometheus
2. **Custom Health Checks**: Permitir plugins de health check
3. **Dashboard**: Criar dashboard Grafana com métricas de saúde
4. **Alerting**: Configurar alertas no Prometheus AlertManager
