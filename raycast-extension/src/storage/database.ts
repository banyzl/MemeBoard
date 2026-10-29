import { mkdir, open, readFile, rename, stat, unlink, access } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { atomicWrite } from "./atomic";
import { Meme, MemeDatabase, MemeInput, UUID_PATTERN } from "./models";
import { validateInput, validateText } from "./triggers";
export interface StoreOptions {
  root?: string;
  rimeDir?: string;
}
export interface MutationResult {
  meme: Meme;
  indexWarning?: string;
}
const supported = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
export function generateIndex(memes: Meme[]): string {
  return (
    memes
      .flatMap((m) => [
        ...m.triggers.map((t) => `T\t${t}\t${m.id}\t${m.name}`),
        `N\t${m.name}\t${m.id}\t${m.name}`,
      ])
      .join("\n") + (memes.length ? "\n" : "")
  );
}
export class MemeStore {
  readonly root: string;
  readonly rimeDir: string;
  constructor(options: StoreOptions = {}) {
    this.root = options.root || join(homedir(), "Library/Application Support/MemeBoard");
    this.rimeDir = options.rimeDir || join(homedir(), "Library/Rime");
  }
  imagePath(meme: Meme): string {
    if (
      !UUID_PATTERN.test(meme.id) ||
      basename(meme.fileName) !== meme.fileName ||
      !supported.has(extname(meme.fileName)) ||
      !meme.fileName.startsWith(`${meme.id}.`)
    )
      throw new Error("图片记录路径无效");
    return join(this.root, "images", meme.fileName);
  }
  async read(): Promise<MemeDatabase> {
    let content: string;
    try {
      content = await readFile(join(this.root, "database.json"), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        return { schemaVersion: 1, memes: [] };
      throw error;
    }
    const db = JSON.parse(content) as MemeDatabase;
    if (db.schemaVersion !== 1 || !Array.isArray(db.memes))
      throw new Error("不支持的数据库版本；已保留原文件");
    const ids = new Set<string>();
    const names = new Set<string>();
    const triggers = new Set<string>();
    for (const m of db.memes) {
      if (
        !m ||
        typeof m.id !== "string" ||
        typeof m.fileName !== "string" ||
        typeof m.name !== "string" ||
        typeof m.favorite !== "boolean" ||
        typeof m.createdAt !== "string" ||
        typeof m.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(m.createdAt)) ||
        !Number.isFinite(Date.parse(m.updatedAt)) ||
        m.originalExtension !== extname(m.fileName).slice(1)
      )
        throw new Error("数据库记录字段不合法");
      this.imagePath(m);
      validateText(m.name, "名称");
      if (
        ids.has(m.id) ||
        names.has(m.name.toLocaleLowerCase()) ||
        !Array.isArray(m.aliases) ||
        !Array.isArray(m.tags) ||
        !Array.isArray(m.triggers) ||
        !m.triggers.length
      )
        throw new Error("数据库记录不合法或重复");
      for (const text of [...m.aliases, ...m.tags]) {
        if (typeof text !== "string") throw new Error("数据库搜索字段不合法");
        validateText(text, "搜索字段");
      }
      ids.add(m.id);
      names.add(m.name.toLocaleLowerCase());
      for (const t of m.triggers) {
        if (!/^[a-z][a-z0-9]{0,63}$/.test(t) || triggers.has(t))
          throw new Error("数据库快捷码不合法或重复");
        triggers.add(t);
      }
    }
    return db;
  }
  private async locked<T>(action: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const lock = join(this.root, ".write.lock");
    let handle;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        handle = await open(lock, "wx", 0o600);
        await handle.writeFile(String(process.pid));
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const info = await stat(lock);
          if (Date.now() - info.mtimeMs > 30000) {
            const pid = Number(await readFile(lock, "utf8"));
            try {
              process.kill(pid, 0);
            } catch (e) {
              if ((e as NodeJS.ErrnoException).code === "ESRCH") await unlink(lock);
            }
          }
        } catch {
          /* Another writer may have released its lock. */
        }
        await new Promise((r) => setTimeout(r, 50));
      }
    }
    if (!handle) throw new Error("数据库正在被另一个命令修改，请稍后重试");
    try {
      return await action();
    } finally {
      await handle.close();
      await unlink(lock);
    }
  }
  async log(event: string): Promise<void> {
    const path = join(this.root, "logs/raycast.log");
    await mkdir(join(this.root, "logs"), { recursive: true, mode: 0o700 });
    try {
      if ((await stat(path)).size > 1_000_000) await rename(path, `${path}.1`);
    } catch {}
    const f = await open(path, "a", 0o600);
    try {
      await f.write(`${new Date().toISOString()} ${event.replace(/[\r\n]/g, " ")}\n`);
    } finally {
      await f.close();
    }
  }
  private async publish(db: MemeDatabase): Promise<string | undefined> {
    // Canonical data commits first. A derived-index error never discards it.
    await atomicWrite(join(this.root, "database.json"), JSON.stringify(db, null, 2) + "\n");
    try {
      await this.syncIndex(db);
    } catch {
      await this.log("index_sync_failed").catch(() => {});
      return "图片已保存，但 Rime 索引未更新。请运行安装 / 修复 Rime 集成。";
    }
  }
  async repairIndex(): Promise<void> {
    return this.locked(() => this.syncIndex());
  }
  async syncIndex(db?: MemeDatabase): Promise<void> {
    // Do not create an absent Rime installation as a side effect of importing.
    await access(this.rimeDir);
    const indexDir = join(this.rimeDir, "memeboard");
    await atomicWrite(
      join(indexDir, "index.tsv"),
      generateIndex((db || (await this.read())).memes),
    );
    await atomicWrite(join(indexDir, "version"), randomUUID() + "\n");
  }
  async importImage(source: string, input: MemeInput): Promise<MutationResult> {
    return this.locked(async () => {
      const db = await this.read();
      const data = validateInput(input, db.memes);
      const extension = extname(source).toLowerCase();
      if (!supported.has(extension)) throw new Error("支持 PNG、JPEG、WebP 和 GIF 图片");
      const info = await stat(source);
      if (!info.isFile() || info.size > 50 * 1024 * 1024)
        throw new Error("图片须为普通文件，且不超过 50 MB");
      const buffer = await readFile(source);
      const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const webp =
        buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
      const gif = /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6));
      if (!{ ".png": png, ".jpg": jpeg, ".jpeg": jpeg, ".webp": webp, ".gif": gif }[extension])
        throw new Error("文件内容与图片扩展名不符");
      const id = randomUUID();
      const now = new Date().toISOString();
      const meme: Meme = {
        id,
        ...data,
        fileName: `${id}${extension}`,
        originalExtension: extension.slice(1),
        favorite: data.favorite || false,
        createdAt: now,
        updatedAt: now,
      };
      const image = this.imagePath(meme);
      await atomicWrite(image, buffer);
      db.memes.push(meme);
      let warning;
      try {
        warning = await this.publish(db);
      } catch (error) {
        await unlink(image).catch(() => {});
        throw error;
      }
      await this.log(`import ${id}`).catch(() => {});
      return { meme, indexWarning: warning };
    });
  }
  async update(id: string, input: MemeInput): Promise<MutationResult> {
    return this.locked(async () => {
      const db = await this.read();
      const index = db.memes.findIndex((m) => m.id === id);
      if (index < 0) throw new Error("图片已不存在，请刷新");
      const data = validateInput(input, db.memes, id);
      const meme = { ...db.memes[index], ...data, updatedAt: new Date().toISOString() };
      db.memes[index] = meme;
      const warning = await this.publish(db);
      await this.log(`update ${id}`).catch(() => {});
      return { meme, indexWarning: warning };
    });
  }
  async remove(id: string): Promise<MutationResult> {
    return this.locked(async () => {
      const db = await this.read();
      const meme = db.memes.find((m) => m.id === id);
      if (!meme) throw new Error("图片已不存在");
      await atomicWrite(
        join(this.root, "trash", `${id}.json`),
        JSON.stringify(meme, null, 2) + "\n",
      );
      db.memes = db.memes.filter((m) => m.id !== id);
      const warning = await this.publish(db);
      await mkdir(join(this.root, "trash"), { recursive: true, mode: 0o700 });
      await rename(this.imagePath(meme), join(this.root, "trash", meme.fileName)).catch(() => {});
      await this.log(`delete ${id}`).catch(() => {});
      return { meme, indexWarning: warning };
    });
  }
}
