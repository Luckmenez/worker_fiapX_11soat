"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FfmpegService = void 0;
const tsyringe_1 = require("tsyringe");
const child_process_1 = require("child_process");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
let FfmpegService = class FfmpegService {
    async extractFrames(options) {
        const { inputPath, outputDir, framesPerSecond, format } = options;
        const framesPattern = path_1.default.join(outputDir, `img_%05d.${format}`);
        const ffmpegArgs = [
            '-y',
            '-hide_banner',
            '-loglevel',
            'error',
            '-i',
            inputPath,
            '-vf',
            `fps=${framesPerSecond}`,
            framesPattern,
        ];
        await this.runFfmpeg(ffmpegArgs);
        const frames = this.listFrames(outputDir, format);
        return {
            frames,
            outputDir,
        };
    }
    runFfmpeg(args) {
        return new Promise((resolve, reject) => {
            if (!ffmpeg_static_1.default) {
                return reject(new Error('ffmpeg binary not found'));
            }
            const process = (0, child_process_1.spawn)(ffmpeg_static_1.default, args, { stdio: ['ignore', 'pipe', 'pipe'] });
            let stderr = '';
            process.stderr.on('data', (data) => (stderr += data.toString()));
            process.on('error', reject);
            process.on('close', (code) => {
                if (code === 0)
                    return resolve();
                reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
            });
        });
    }
    listFrames(dirPath, format) {
        return fs_1.default
            .readdirSync(dirPath)
            .filter((file) => file.startsWith('img') && file.endsWith(`.${format}`))
            .sort();
    }
};
exports.FfmpegService = FfmpegService;
exports.FfmpegService = FfmpegService = __decorate([
    (0, tsyringe_1.injectable)()
], FfmpegService);
//# sourceMappingURL=ffmpeg.service.js.map