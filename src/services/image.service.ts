import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

const SIZES = {
  product: [
    { suffix: 'lg', width: 800, height: 800 },
    { suffix: 'md', width: 400, height: 400 },
    { suffix: 'sm', width: 200, height: 200 },
  ],
  avatar: [
    { suffix: 'md', width: 200, height: 200 },
    { suffix: 'sm', width: 80, height: 80 },
  ],
};

export const processProductImage = async (filePath: string): Promise<string> => {
  const filename = uuidv4();
  const outputDir = path.join(UPLOAD_DIR, 'products');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${filename}.webp`);

  await sharp(filePath)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outputPath);

  // Also create thumbnail
  await sharp(filePath)
    .resize(300, 300, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(path.join(outputDir, `${filename}_thumb.webp`));

  // Remove temp file
  await fs.unlink(filePath).catch(() => {});

  return `/uploads/products/${filename}.webp`;
};

export const processAvatarImage = async (filePath: string): Promise<string> => {
  const filename = uuidv4();
  const outputDir = path.join(UPLOAD_DIR, 'avatars');
  await fs.mkdir(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `${filename}.webp`);

  await sharp(filePath)
    .resize(200, 200, { fit: 'cover', position: 'center' })
    .webp({ quality: 85 })
    .toFile(outputPath);

  await fs.unlink(filePath).catch(() => {});
  return `/uploads/avatars/${filename}.webp`;
};

export const deleteImage = async (imagePath: string) => {
  if (!imagePath || !imagePath.startsWith('/uploads/')) return;
  const fullPath = path.join(process.cwd(), imagePath);
  await fs.unlink(fullPath).catch(() => {});

  // Also delete thumbnail
  const thumbPath = fullPath.replace('.webp', '_thumb.webp');
  await fs.unlink(thumbPath).catch(() => {});
};
