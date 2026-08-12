/** Strips the extension from an uploaded file's original name, e.g. "photo.jpg" -> "photo". */
export function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^./\\]+$/, "");
}
