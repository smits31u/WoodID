import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface CapturedPhoto {
  key: string;
  base64: string;
  uri: string;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

export async function compressPhoto(uri: string, width: number, height: number) {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_DIMENSION) {
    context.resize(width >= height ? { width: MAX_DIMENSION } : { height: MAX_DIMENSION });
  }
  const rendered = await context.renderAsync();
  return rendered.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true });
}
