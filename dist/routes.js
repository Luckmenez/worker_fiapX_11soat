"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processVideoRoutes = void 0;
const express_1 = require("express");
const container_1 = require("./shared/container");
const process_video_controller_1 = require("./features/process-video/process-video.controller");
const multer_config_1 = require("./shared/config/multer.config");
exports.processVideoRoutes = (0, express_1.Router)();
const controller = container_1.container.resolve(process_video_controller_1.ProcessVideoController);
exports.processVideoRoutes.post('/process', multer_config_1.uploadVideo.single('file'), (req, res) => controller.process(req, res));
//# sourceMappingURL=routes.js.map