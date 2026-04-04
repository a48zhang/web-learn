import multer from 'multer';
import path from 'path';
import { getStorageService } from '../services/storageService';

const allowedMimeTypes = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isZipExt = ext === '.zip';

  if (!isZipExt || !allowedMimeTypes.has(file.mimetype)) {
    cb(new Error('Only ZIP files are supported'));
    return;
  }

  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

/**
 * Upload a file buffer to storage service.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToStorageService(
  buffer: Buffer,
  filename: string,
  ossKey: string
): Promise<string> {
  const service = getStorageService();
  return service.uploadBuffer(buffer, ossKey);
}

