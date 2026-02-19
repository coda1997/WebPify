export function toWebpFilename(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${fileName}.webp`;
  }

  return `${fileName.slice(0, dotIndex)}.webp`;
}
