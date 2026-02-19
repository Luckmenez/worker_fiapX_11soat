"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
const router = (0, express_1.Router)();
exports.healthRoutes = router;
const healthController = new health_controller_1.HealthController();
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
//# sourceMappingURL=health.routes.js.map