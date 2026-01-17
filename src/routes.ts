import { Router } from 'express';
import { container } from './shared/container';
import { ProcessVideoController } from './features/process-video/process-video.controller';
import { uploadVideo } from './shared/config/multer.config';

export const processVideoRoutes = Router();

const controller = container.resolve(ProcessVideoController);

processVideoRoutes.post('/process', uploadVideo.single('file'), (req, res) =>
  controller.process(req, res)
);
