export async function readPhoto(uri: string): Promise<{ bytes: ArrayBuffer; mime: string }> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Unable to read the selected photo.');
  const blob = await response.blob();
  return { bytes: await blob.arrayBuffer(), mime: blob.type };
}
