import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();
const healthController = new HealthController();

/**
 * @route   GET /health
 * @desc    Basic health check - simple status without dependency checks
 * @access  Public
 */
router.get('/', (req, res) => healthController.basic(req, res));

/**
 * @route   GET /health/detailed
 * @desc    Detailed health check - verifies all dependencies (S3, RabbitMQ, Elasticsearch, FFmpeg)
 * @access  Public
 */
router.get('/detailed', (req, res) => healthController.detailed(req, res));

/**
 * @route   GET /health/readiness
 * @desc    Kubernetes readiness probe - checks if service is ready to receive traffic
 * @access  Public
 */
router.get('/readiness', (req, res) => healthController.readiness(req, res));

/**
 * @route   GET /health/liveness
 * @desc    Kubernetes liveness probe - checks if service is alive
 * @access  Public
 */
router.get('/liveness', (req, res) => healthController.liveness(req, res));

export { router as healthRoutes };
