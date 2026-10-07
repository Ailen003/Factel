import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const REPORTS_DIR = path.join(process.cwd(), ".generated", "reports");

export async function saveReportToFile(
  buffer: Buffer,
  filename: string,
): Promise<string> {
  await fs.mkdir(REPORTS_DIR, { recursive: true });

  const uniqueFilename = `${randomUUID()}_${filename}`;
  const filePath = path.join(REPORTS_DIR, uniqueFilename);

  await fs.writeFile(filePath, buffer);

  return uniqueFilename;
}

export async function getReportFilePath(
  filename: string,
): Promise<string | null> {
  const safe = path.basename(filename);
  const filePath = path.join(REPORTS_DIR, safe);

  try {
    await fs.access(filePath);
    return filePath;
  } catch {
    return null;
  }
}

export async function deleteReportFile(filename: string): Promise<boolean> {
  const safe = path.basename(filename);
  const filePath = path.join(REPORTS_DIR, safe);

  try {
    await fs.unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
