import { readFile, mkdir, copyFile, chmod, access } from "node:fs/promises";
import { join, basename } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { parseDocument, YAMLMap } from "yaml";
import { atomicWrite } from "../storage/atomic";
import { MemeStore } from "../storage/database";
const BEFORE = "lua_processor@*meme_tips*before";
const AFTER = "lua_processor@*meme_tips*after";
const owned = (value: unknown) => value === BEFORE || value === AFTER;
export interface IntegrationOptions {
  rimeDir: string;
  dataDir: string;
  assetsDir: string;
  schemaId?: string;
}
function document(text: string) {
  const doc = parseDocument(text);
  if (doc.errors.length) throw new Error(`Rime 配置解析失败：${doc.errors[0].message}`);
  if (doc.contents && !(doc.contents instanceof YAMLMap))
    throw new Error("Rime custom 配置必须为 YAML mapping");
  return doc;
}
export function patchIntegration(
  custom: string,
  processors: string[],
  tipsKey: string,
  remove = false,
): string {
  const doc = document(custom || "patch: {}\n");
  if (!doc.has("patch")) doc.set("patch", {});
  const patch = doc.get("patch");
  if (!(patch instanceof YAMLMap))
    throw new Error("custom 配置中的 patch 必须为 mapping，原配置已保留");
  // Remove only our own entries; unrelated user patches and comments survive.
  for (const item of [...patch.items])
    if (
      owned(
        item.value && typeof item.value === "object" && "value" in item.value
          ? item.value.value
          : item.value,
      )
    )
      patch.delete(item.key);
  if (remove) {
    patch.delete("memeboard");
    return doc.toString();
  }
  const clean = processors.filter((p) => !owned(p));
  const index = clean.findIndex((p) => /wanxiang[./]super_tips$/.test(p));
  if (index < 0)
    throw new Error("当前方案未发现万象 super_tips processor，已停止安装，原配置未改动");
  for (const [key, value] of [
    [`engine/processors/@before ${index}`, BEFORE],
    [`engine/processors/@after ${index}`, AFTER],
  ]) {
    if (patch.has(key)) throw new Error(`已有自定义 processor patch「${key}」，请先调整插入位置`);
    patch.set(key, value);
  }
  const existing = patch.get("memeboard");
  if (existing && !(existing instanceof YAMLMap)) throw new Error("已有 memeboard 配置类型不兼容");
  if (!existing)
    patch.set("memeboard", {
      meme_key: tipsKey,
      fallback_key: tipsKey === "semicolon" ? "Control+semicolon" : "semicolon",
    });
  return doc.toString();
}
export async function installIntegration(options: IntegrationOptions): Promise<string> {
  const { rimeDir, dataDir, assetsDir } = options;
  const schema = options.schemaId || "wanxiang";
  if (!/^[a-zA-Z0-9_-]+$/.test(schema)) throw new Error("方案 ID 不合法");
  await access(rimeDir);
  const builtPath = join(rimeDir, "build", `${schema}.schema.yaml`);
  const builtText = await readFile(builtPath, "utf8");
  const built = document(builtText).toJS();
  const processors = built.engine?.processors;
  if (!Array.isArray(processors) || !processors.every((p) => typeof p === "string"))
    throw new Error("找不到当前已部署方案的 processors");
  const tipsKey =
    typeof built.super_tips?.tips_key === "string" ? built.super_tips.tips_key : "comma";
  const customPath = join(rimeDir, `${schema}.custom.yaml`);
  let custom = "";
  try {
    custom = await readFile(customPath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const next = patchIntegration(custom, processors, tipsKey);
  // Confirm assets are complete before touching the live installation.
  const lua = await readFile(join(assetsDir, "meme_tips.lua"));
  const helper = await readFile(join(assetsDir, "memeboard-helper"));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const backup = join(dataDir, "backups", stamp);
  await mkdir(backup, { recursive: true, mode: 0o700 });
  const paths = [
    customPath,
    join(rimeDir, "lua/meme_tips.lua"),
    join(dataDir, "bin/memeboard-helper"),
  ];
  const saved: { path: string; backup: string | null }[] = [];
  for (let i = 0; i < paths.length; i++) {
    try {
      const dest = `${i}-${basename(paths[i])}`;
      await copyFile(paths[i], join(backup, dest));
      saved.push({ path: paths[i], backup: dest });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      saved.push({ path: paths[i], backup: null });
    }
  }
  const hash = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
  const upstreamPath = join(rimeDir, "lua/wanxiang/super_tips.lua");
  const upstream = await readFile(upstreamPath);
  await atomicWrite(
    join(backup, "manifest.json"),
    JSON.stringify(
      {
        schema,
        createdAt: new Date().toISOString(),
        files: saved,
        upstream: { superTipsHash: hash(upstream), deployedSchemaHash: hash(builtText) },
        customAfterHash: hash(next),
      },
      null,
      2,
    ),
  );
  const helperPath = join(dataDir, "bin/memeboard-helper");
  let unchanged = false;
  try {
    unchanged = hash(await readFile(helperPath)) === hash(helper);
  } catch {}
  // Keep an identical helper in place, preserving its existing OS authorization.
  if (!unchanged) await atomicWrite(helperPath, helper, 0o755);
  await chmod(helperPath, 0o755);
  await atomicWrite(join(rimeDir, "lua/meme_tips.lua"), lua);
  await new MemeStore({ root: dataDir, rimeDir }).repairIndex();
  // Custom patch is installed last. No upstream schema, loader or tips data is edited.
  await atomicWrite(customPath, next);
  await atomicWrite(
    join(dataDir, "integration.json"),
    JSON.stringify({ schema, rimeDir, backup, installedAt: new Date().toISOString() }, null, 2),
  );
  return backup;
}
export async function removeIntegration(rimeDir: string, schema = "wanxiang"): Promise<void> {
  if (!/^[a-zA-Z0-9_-]+$/.test(schema)) throw new Error("方案 ID 不合法");
  const path = join(rimeDir, `${schema}.custom.yaml`);
  const custom = await readFile(path, "utf8");
  const next = patchIntegration(custom, [], "comma", true);
  await atomicWrite(`${path}.memeboard-uninstall-${Date.now()}.bak`, custom);
  await atomicWrite(path, next);
  // Keep Lua and library data on disk for rollback; they are no longer loaded.
}
