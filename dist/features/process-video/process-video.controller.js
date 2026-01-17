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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessVideoController = void 0;
const tsyringe_1 = require("tsyringe");
let ProcessVideoController = class ProcessVideoController {
    service;
    constructor(service) {
        this.service = service;
    }
    async process(req, res) {
        try {
            if (!req.file) {
                res.status(400).json({ error: 'No video file provided' });
                return;
            }
            const framesPerSecond = Number(req.body.frames_per_second || 1);
            const format = String(req.body.format || 'jpg').toLowerCase();
            const result = await this.service.processVideo({
                file: req.file.filename,
                framesPerSecond,
                format,
            });
            res.json(result);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            res.status(500).json({ error: message });
        }
    }
};
exports.ProcessVideoController = ProcessVideoController;
exports.ProcessVideoController = ProcessVideoController = __decorate([
    (0, tsyringe_1.injectable)(),
    __param(0, (0, tsyringe_1.inject)('ProcessVideoService')),
    __metadata("design:paramtypes", [Object])
], ProcessVideoController);
//# sourceMappingURL=process-video.controller.js.map