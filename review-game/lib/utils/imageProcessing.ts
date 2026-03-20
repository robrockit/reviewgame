import sharp from 'sharp';

export async function processImage(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}
