import { constants } from "node:fs";
import { open, rename, mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
export async function atomicWrite(
  path: string,
  content: string | Buffer,
  mode = 0o600,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temp = `${path}.${randomUUID()}.tmp`;
  try {
    const handle = await open(
      temp,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      mode,
    );
    try {
      await handle.writeFile(content);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temp, path);
    const directory = await open(dirname(path), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}
