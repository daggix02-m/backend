import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const allowedDocTypes = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
];

const allowedSpreadsheetTypes = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const fileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (allowedDocTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Invalid file type. Only PDF, JPEG, JPG, and PNG files are allowed.'));
};

const spreadsheetFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (allowedSpreadsheetTypes.includes(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV files are allowed.'));
};

const storage = multer.memoryStorage();

export const uploadDocument = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
});

export const uploadSpreadsheet = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: spreadsheetFilter,
});

export const uploadMultiple = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (allowedDocTypes.includes(file.mimetype) || allowedSpreadsheetTypes.includes(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type.'));
  },
});
