"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.container = void 0;
const tsyringe_1 = require("tsyringe");
Object.defineProperty(exports, "container", { enumerable: true, get: function () { return tsyringe_1.container; } });
const ffmpeg_service_1 = require("../../features/ffmpeg/ffmpeg.service");
const process_video_service_1 = require("../../features/process-video/process-video.service");
tsyringe_1.container.registerSingleton('FfmpegService', ffmpeg_service_1.FfmpegService);
tsyringe_1.container.registerSingleton('ProcessVideoService', process_video_service_1.ProcessVideoService);
//# sourceMappingURL=index.js.map