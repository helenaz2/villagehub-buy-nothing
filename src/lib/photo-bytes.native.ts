import { File } from 'expo-file-system';
export async function readPhoto(uri: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const file = new File(uri);
  return { bytes: await file.arrayBuffer(), mime: file.type };
}
