"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessVideoService = void 0;
const path_1 = __importDefault(require("path"));
const tsyringe_1 = require("tsyringe");
const utils_1 = require("../../shared/utils");
const INPUT_DIR = path_1.default.resolve('./input');
const OUTPUT_DIR = path_1.default.resolve('./output');
let ProcessVideoService = class ProcessVideoService {
    ffmpegService;
    constructor(ffmpegService) {
        this.ffmpegService = ffmpegService;
        (0, utils_1.ensureDir)(INPUT_DIR);
        (0, utils_1.ensureDir)(OUTPUT_DIR);
    }
    async processVideo(options) {
        const { file, framesPerSecond = 1, format = 'jpg' } = options;
        const inputPath = (0, utils_1.safeJoin)(INPUT_DIR, file);
        const tmpDir = (0, utils_1.createTempDir)('frames-');
        const startedAt = Date.now();
        try {
            const { frames } = await this.ffmpegService.extractFrames({
                inputPath,
                outputDir: tmpDir,
                framesPerSecond,
                format,
            });
            const baseName = path_1.default.parse(file).name;
            const zipName = `${baseName}_frames_${framesPerSecond}_frames_per_second.zip`;
            const zipPath = path_1.default.join(OUTPUT_DIR, zipName);
            await (0, utils_1.zipDirectory)(tmpDir, zipPath);
            const durationMs = Date.now() - startedAt;
            return {
                ok: true,
                input: file,
                framesPerSecond,
                format,
                frames: frames.length,
                zipFile: zipName,
                zipPath,
                durationMs,
            };
        }
        finally {
            (0, utils_1.removeDir)(tmpDir);
        }
    }
};
exports.ProcessVideoService = ProcessVideoService;
exports.ProcessVideoService = ProcessVideoService = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)('FfmpegService')),
    __metadata("design:paramtypes", [Object])
], ProcessVideoService);
//# sourceMappingURL=process-video.service.js.map