import multer from 'multer';
import path from 'path';
import { ensureDir } from '../utils';

const INPUT_DIR = path.resolve('./input');

ensureDir(INPUT_DIR);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, INPUT_DIR);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const allowedMimeTypes = ['video/mp4', 'video/avi', 'video/mkv', 'video/webm', 'video/quicktime'];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only video files are allowed.`));
  }
};

export const uploadVideo = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB
  },
});
