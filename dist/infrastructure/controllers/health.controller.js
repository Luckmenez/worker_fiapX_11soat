"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const tsyringe_1 = require("tsyringe");
const health_check_use_case_1 = require("../../application/use-cases/health-check.use-case");
const monitoring_1 = require("../monitoring");
class HealthController {
    /**
     * Basic health check
     * Returns simple status without checking dependencies
     * Useful for load balancers and quick checks
     */
    async basic(_req, res) {
        monitoring_1.logger.info({ type: 'health.basic' }, 'Basic health check requested');
        return res.status(200).json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            service: 'worker-fiapx-11soat',
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development',
        });
    }
    /**
     * Detailed health check
     * Verifies all dependencies: S3, RabbitMQ, Elasticsearch, FFmpeg
     * Returns 200 for healthy/degraded, 503 for unhealthy
     */
    async detailed(_req, res) {
        monitoring_1.logger.info({ type: 'health.detailed' }, 'Detailed health check requested');
        const healthCheckUseCase = tsyringe_1.container.resolve(health_check_use_case_1.HealthCheckUseCase);
        try {
            const result = await healthCheckUseCase.execute();
            // Log do resultado
            monitoring_1.logger.info({
                type: 'health.result',
                status: result.status,
                services: Object.entries(result.services).reduce((acc, [key, value]) => ({
                    ...acc,
                    [key]: value.status,
                }), {}),
            }, `Health check completed: ${result.status}`);
            // HTTP status code baseado no status geral
            const httpStatus = result.status === 'healthy'
                ? 200
                : result.status === 'degraded'
                    ? 200
                    : 503;
            return res.status(httpStatus).json(result);
        }
        catch (error) {
            monitoring_1.logger.error({
                type: 'health.error',
                error: error instanceof Error ? error.message : 'Unknown error',
            }, 'Health check failed');
            return res.status(503).json({
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Health check failed',
                services: {
                    s3: { status: 'error', error: 'Health check failed' },
                    rabbitmq: { status: 'error', error: 'Health check failed' },
                    elasticsearch: { status: 'error', error: 'Health check failed' },
                    ffmpeg: { status: 'error', error: 'Health check failed' },
                },
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                environment: process.env.NODE_ENV || 'development',
            });
        }
        finally {
            await healthCheckUseCase.cleanup();
        }
    }
    /**
     * Readiness check
     * Used by Kubernetes to determine if pod is ready to receive traffic
     * Checks critical services only (S3, RabbitMQ, FFmpeg)
     */
    async readiness(_req, res) {
        monitoring_1.logger.info({ type: 'health.readiness' }, 'Readiness check requested');
        const healthCheckUseCase = tsyringe_1.container.resolve(health_check_use_case_1.HealthCheckUseCase);
        try {
            const result = await healthCheckUseCase.execute();
            const isReady = result.services.s3.status === 'ok' &&
                result.services.rabbitmq.status === 'ok' &&
                result.services.ffmpeg.status === 'ok';
            if (isReady) {
                return res.status(200).json({
                    status: 'ready',
                    timestamp: new Date().toISOString(),
                });
            }
            else {
                return res.status(503).json({
                    status: 'not-ready',
                    timestamp: new Date().toISOString(),
                    services: result.services,
                });
            }
        }
        catch (error) {
            return res.status(503).json({
                status: 'not-ready',
                timestamp: new Date().toISOString(),
                error: error instanceof Error ? error.message : 'Readiness check failed',
            });
        }
        finally {
            await healthCheckUseCase.cleanup();
        }
    }
    /**
     * Liveness check
     * Used by Kubernetes to determine if pod should be restarted
     * Simple check that worker process is running
     */
    async liveness(_req, res) {
        // Liveness apenas verifica se o processo está vivo
        // Não faz checks de dependências
        return res.status(200).json({
            status: 'alive',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    }
}
exports.HealthController = HealthController;
//# sourceMappingURL=health.controller.js.map