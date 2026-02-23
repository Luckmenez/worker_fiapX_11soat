import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

const router = Router();
const healthController = new HealthController();

router.get('/', (req, res) => healthController.basic(req, res));

router.get('/detailed', (req, res) => healthController.detailed(req, res));

router.get('/readiness', (req, res) => healthController.readiness(req, res));

router.get('/liveness', (req, res) => healthController.liveness(req, res));

export { router as healthRoutes };
