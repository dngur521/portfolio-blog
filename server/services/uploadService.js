const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const pool = require('../db/pool');

// file-type v17+ is ESM-only; dynamic import() works from this CommonJS module.
let fileTypeFromBufferPromise;
function loadFileTypeFromBuffer() {
  if (!fileTypeFromBufferPromise) {
    fileTypeFromBufferPromise = import('file-type').then((mod) => mod.fileTypeFromBuffer);
  }
  return fileTypeFromBufferPromise;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const UPLOADS_ROOT = path.resolve(PROJECT_ROOT, 'uploads', 'images');
const ALLOWED_EXTENSIONS = new Set(['jpg', 'png', 'webp', 'gif']);
const MAX_WIDTH = 1920;

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

async function reencodeImage(buffer, ext) {
  // sharp로 재인코딩하면 EXIF(GPS 등) 메타데이터가 기본적으로 제거된다.
  // 애니메이션 GIF는 재인코딩 시 프레임이 손실될 수 있어 원본 그대로 저장한다.
  if (ext === 'gif') return buffer;

  let pipeline = sharp(buffer, { animated: false }).rotate();
  const metadata = await sharp(buffer).metadata();
  if (metadata.width && metadata.width > MAX_WIDTH) {
    pipeline = pipeline.resize({ width: MAX_WIDTH });
  }

  switch (ext) {
    case 'png':
      return pipeline.png().toBuffer();
    case 'webp':
      return pipeline.webp().toBuffer();
    default:
      return pipeline.jpeg().toBuffer();
  }
}

async function processUpload({ buffer, uploadedBy }) {
  const fileTypeFromBuffer = await loadFileTypeFromBuffer();
  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_EXTENSIONS.has(detected.ext)) {
    throw badRequest('허용되지 않는 이미지 형식입니다.');
  }

  const finalBuffer = await reencodeImage(buffer, detected.ext);

  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const filename = `${crypto.randomUUID()}.${detected.ext}`;

  const dir = path.resolve(UPLOADS_ROOT, yyyy, mm);
  await fs.mkdir(dir, { recursive: true });
  const finalPath = path.resolve(dir, filename);
  await fs.writeFile(finalPath, finalBuffer);

  const relativePath = path.relative(PROJECT_ROOT, finalPath);
  await pool.execute(
    `INSERT INTO uploads (filename, file_path, uploaded_by, mime_type, size_bytes)
     VALUES (?, ?, ?, ?, ?)`,
    [filename, relativePath, uploadedBy, detected.mime, finalBuffer.length]
  );

  return { url: `/uploads/images/${yyyy}/${mm}/${filename}` };
}

module.exports = { processUpload, ALLOWED_EXTENSIONS };
