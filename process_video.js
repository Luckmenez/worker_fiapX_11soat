import express from "express";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import archiver from "archiver";

const app = express();

const INPUT_DIR = path.resolve("./input");
const OUTPUT_DIR = path.resolve("./output");

fs.mkdirSync(INPUT_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function safeJoin(baseDir, fileName) {
  const full = path.resolve(baseDir, fileName);
  if (!full.startsWith(baseDir + path.sep))
    throw new Error("Invalid file path");
  return full;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });

    let stderr = "";
    p.stderr.on("data", (d) => (stderr += d.toString()));

    p.on("error", reject);
    p.on("close", (code) => {
      if (code === 0) return resolve();
      reject(new Error(`ffmpeg exited with code ${code}\n${stderr}`));
    });
  });
}

async function zipDirectory(dirPath, zipPath) {
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);

    archive.pipe(output);
    archive.directory(dirPath, false);
    archive.finalize();
  });
}

function listFrames(dirPath) {
  return fs
    .readdirSync(dirPath)
    .filter((f) => f.startsWith("img") && f.endsWith(".png"))
    .sort();
}

app.post("/process", async (req, res) => {
  try {
    const file = String(req.query.file || "");
    const framesPerSecond = Number(req.query.frames_per_second || 1);
    const format = String(req.query.format || "jpg").toLowerCase();

    const inputPath = safeJoin(INPUT_DIR, file);

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "frames-"));
    const framesPattern = path.join(tmpDir, `img_%05d.${format}`);

    const ffmpegArgs = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-vf",
      `fps=${framesPerSecond}`,
      framesPattern,
    ];

    const startedAt = Date.now();
    await runFfmpeg(ffmpegArgs);

    const frames = listFrames(tmpDir);

    const baseName = path.parse(file).name;
    const zipName = `${baseName}_frames_${framesPerSecond}_frames_per_second.zip`;
    const zipPath = path.join(OUTPUT_DIR, zipName);

    await zipDirectory(tmpDir, zipPath);

    fs.rmSync(tmpDir, { recursive: true, force: true });

    const durationMs = Date.now() - startedAt;

    return res.json({
      ok: true,
      input: file,
      framesPerSecond,
      format,
      frames: frames.length,
      zipFile: zipName,
      zipPath,
      durationMs,
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message });
  }
});

app.get("/health/check", (_, res) => res.json({ status: "api is running" }));

app.listen(3000, () => {
  console.log("Server running");
  console.log(`folder input dir:  ${INPUT_DIR}`);
  console.log(`folder output dir: ${OUTPUT_DIR}`);
});
