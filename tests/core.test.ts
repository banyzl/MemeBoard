import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "../raycast-extension/node_modules/yaml";
import { MemeStore, generateIndex } from "../raycast-extension/src/storage/database";
import { atomicWrite } from "../raycast-extension/src/storage/atomic";
import { pinyinTriggers } from "../raycast-extension/src/storage/triggers";
import { LocalSearchProvider } from "../raycast-extension/src/search/local";
import {
  installIntegration,
  patchIntegration,
  removeIntegration,
} from "../raycast-extension/src/rime/installer";
const before = "lua_processor@*meme_tips*before",
  after = "lua_processor@*meme_tips*after",
  official = "lua_processor@*wanxiang.super_tips";
const image = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
  "base64",
);
async function setup(t: test.TestContext) {
  const dir = await mkdtemp(join(tmpdir(), "memeboard-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const root = join(dir, "data"),
    rimeDir = join(dir, "rime"),
    source = join(dir, "source.png");
  await mkdir(rimeDir);
  await writeFile(source, image);
  return { dir, root, rimeDir, source, store: new MemeStore({ root, rimeDir }) };
}
test("pinyin generates full spelling and initials", () => {
  assert.deepEqual(pinyinTriggers("猫猫无语"), ["maomaowuyu", "mmwy"]);
});
test("import copies source, uses UUID, writes name and trigger index", async (t) => {
  const f = await setup(t);
  const { meme, indexWarning } = await f.store.importImage(f.source, { name: "猫猫无语" });
  assert.equal(indexWarning, undefined);
  assert.match(meme.id, /^[a-f0-9-]{36}$/);
  assert.equal(meme.fileName, `${meme.id}.png`);
  assert.deepEqual(await readFile(f.source), image);
  assert.deepEqual(await readFile(f.store.imagePath(meme)), image);
  const index = await readFile(join(f.rimeDir, "memeboard/index.tsv"), "utf8");
  assert.ok(index.includes(`N\t猫猫无语\t${meme.id}`));
  assert.ok(index.includes(`T\tmmwy\t${meme.id}`));
  assert.ok(await readFile(join(f.rimeDir, "memeboard/version"), "utf8"));
});
test("rename preserves UUID and image path, updates name index", async (t) => {
  const f = await setup(t);
  const { meme } = await f.store.importImage(f.source, { name: "猫猫无语" });
  const updated = await f.store.update(meme.id, {
    name: "猫猫很无语",
    aliases: ["沉默猫"],
    tags: ["猫"],
  });
  assert.equal(updated.meme.id, meme.id);
  assert.equal(updated.meme.fileName, meme.fileName);
  const index = await readFile(join(f.rimeDir, "memeboard/index.tsv"), "utf8");
  assert.ok(index.includes("N\t猫猫很无语\t"));
  assert.ok(!index.includes("N\t猫猫无语\t"));
});
test("duplicate names and colliding explicit triggers are rejected without overwriting", async (t) => {
  const f = await setup(t);
  await f.store.importImage(f.source, { name: "猫猫无语" });
  await assert.rejects(f.store.importImage(f.source, { name: "猫猫无语" }), /已存在/);
  await assert.rejects(
    f.store.importImage(f.source, { name: "另一张", triggers: ["mmwy"] }),
    /已被/,
  );
  assert.equal((await f.store.read()).memes.length, 1);
});
test("full pinyin collisions require an explicit alternative", async (t) => {
  const f = await setup(t);
  await f.store.importImage(f.source, { name: "无语" });
  await assert.rejects(f.store.importImage(f.source, { name: "无雨" }), /wuyu/);
  const result = await f.store.importImage(f.source, { name: "无雨", triggers: ["wuyu2"] });
  assert.deepEqual(result.meme.triggers, ["wuyu2"]);
});
test("colliding suggested initials are omitted", async (t) => {
  const f = await setup(t);
  await f.store.importImage(f.source, { name: "猫猫无语", triggers: ["mmwy"] });
  const result = await f.store.importImage(f.source, { name: "喵喵无言" });
  assert.ok(!result.meme.triggers.includes("mmwy"));
});
test("delete removes all index keys and retains recoverable file and metadata", async (t) => {
  const f = await setup(t);
  const { meme } = await f.store.importImage(f.source, { name: "猫猫无语" });
  await f.store.remove(meme.id);
  assert.equal((await f.store.read()).memes.length, 0);
  assert.equal(await readFile(join(f.rimeDir, "memeboard/index.tsv"), "utf8"), "");
  await access(join(f.root, "trash", meme.fileName));
  assert.equal(
    JSON.parse(await readFile(join(f.root, "trash", `${meme.id}.json`), "utf8")).id,
    meme.id,
  );
});
test("search covers name, aliases, tags, triggers", async (t) => {
  const f = await setup(t);
  const { meme } = await f.store.importImage(f.source, {
    name: "猫猫无语",
    aliases: ["无语猫", "沉默猫"],
    tags: ["尴尬"],
  });
  const search = new LocalSearchProvider();
  for (const query of ["猫", "无语", "沉默", "无语猫", "尴尬", "mmwy", "maomaowuyu"])
    assert.deepEqual(search.search(query, [meme]), [meme]);
  assert.deepEqual(search.search("没有", [meme]), []);
});
test("concurrent writers do not lose records", async (t) => {
  const f = await setup(t);
  await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      f.store.importImage(f.source, { name: `图片${i}`, triggers: [`image${i}`] }),
    ),
  );
  assert.equal((await f.store.read()).memes.length, 10);
  assert.equal(new Set((await f.store.read()).memes.map((m) => m.id)).size, 10);
});
test("atomic replacement never exposes incomplete JSON and leaves no temporary files", async (t) => {
  const f = await setup(t);
  const path = join(f.dir, "atomic.json");
  await atomicWrite(path, JSON.stringify({ n: 0, payload: "x".repeat(5000) }));
  let done = false;
  let reads = 0;
  const reader = (async () => {
    while (!done) {
      const value = JSON.parse(await readFile(path, "utf8"));
      assert.equal(value.payload.length, 5000);
      reads++;
    }
  })();
  try {
    for (let n = 1; n <= 15; n++)
      await atomicWrite(path, JSON.stringify({ n, payload: "x".repeat(5000) }));
  } finally {
    done = true;
    await reader;
  }
  assert.ok(reads > 0);
  assert.ok(!(await readdir(f.dir)).some((name) => name.endsWith(".tmp")));
});
test("failed derived index preserves committed canonical data; repair recovers", async (t) => {
  const f = await setup(t);
  await writeFile(join(f.rimeDir, "memeboard"), "blocks directory");
  const result = await f.store.importImage(f.source, { name: "猫猫无语" });
  assert.ok(result.indexWarning);
  assert.equal((await f.store.read()).memes.length, 1);
  await rm(join(f.rimeDir, "memeboard"));
  await f.store.syncIndex();
  assert.ok(
    (await readFile(join(f.rimeDir, "memeboard/index.tsv"), "utf8")).includes(result.meme.id),
  );
});
test("unsupported database versions are never overwritten", async (t) => {
  const f = await setup(t);
  await mkdir(f.root);
  const data = '{"schemaVersion":99,"memes":[]}';
  await writeFile(join(f.root, "database.json"), data);
  await assert.rejects(f.store.importImage(f.source, { name: "猫猫无语" }), /版本/);
  assert.equal(await readFile(join(f.root, "database.json"), "utf8"), data);
});
test("invalid metadata, shell-like triggers and mismatched images are rejected", async (t) => {
  const f = await setup(t);
  await assert.rejects(f.store.importImage(f.source, { name: "猫\t猫" }));
  await assert.rejects(f.store.importImage(f.source, { name: "猫", triggers: ["a;touch x"] }));
  await writeFile(f.source, "not an image");
  await assert.rejects(f.store.importImage(f.source, { name: "猫" }), /内容/);
});
test("patch preserves comments and unrelated preferences, installs idempotently", () => {
  const text =
    "# 用户的说明\npatch:\n  switches/@10/reset: 1 # 保留这个注释\n  translator/contextual_suggestions: true\n";
  const patched = patchIntegration(text, ["foo", official, "bar"], "comma");
  assert.ok(patched.includes("保留这个注释"));
  assert.ok(patched.includes("用户的说明"));
  assert.equal(parse(patched).patch["translator/contextual_suggestions"], true);
  assert.equal(parse(patched).patch["engine/processors/@before 1"], before);
  assert.equal(parse(patched).patch["engine/processors/@after 1"], after);
  assert.equal(parse(patched).patch.memeboard.meme_key, "comma");
  const repaired = patchIntegration(patched, ["foo", before, official, after, "bar"], "comma");
  assert.deepEqual(parse(repaired), parse(patched));
  const removed = patchIntegration(repaired, [], "comma", true);
  assert.equal(parse(removed).patch["switches/@10/reset"], 1);
  assert.ok(!removed.includes("meme_tips"));
});
test("installer refuses ambiguous existing patches without changing them", () => {
  assert.throws(
    () => patchIntegration("patch:\n  engine/processors/@before 0: custom\n", [official], "comma"),
    /已有自定义/,
  );
  assert.throws(() => patchIntegration("patch: [bad]\n", [official], "comma"), /mapping/);
  assert.throws(() => patchIntegration("patch: {}\n", ["speller"], "comma"), /未发现/);
});
test("install and uninstall preserve upstream files and create backup manifest", async (t) => {
  const f = await setup(t);
  await mkdir(join(f.rimeDir, "build"));
  await mkdir(join(f.rimeDir, "lua/wanxiang"), { recursive: true });
  const assets = join(f.dir, "assets");
  await mkdir(assets);
  await writeFile(
    join(f.rimeDir, "build/wanxiang.schema.yaml"),
    `engine:\n  processors:\n    - ${official}\n    - speller\nsuper_tips: {tips_key: comma}\n`,
  );
  await writeFile(join(f.rimeDir, "lua/wanxiang/super_tips.lua"), "upstream stays the same");
  await writeFile(
    join(f.rimeDir, "wanxiang.custom.yaml"),
    "# comment\npatch:\n  switches/@10/reset: 1\n",
  );
  await writeFile(join(assets, "meme_tips.lua"), "lua module");
  await writeFile(join(assets, "memeboard-helper"), "helper binary");
  const backup = await installIntegration({
    rimeDir: f.rimeDir,
    dataDir: f.root,
    assetsDir: assets,
  });
  await access(join(backup, "manifest.json"));
  assert.equal(
    await readFile(join(f.rimeDir, "lua/wanxiang/super_tips.lua"), "utf8"),
    "upstream stays the same",
  );
  await removeIntegration(f.rimeDir);
  const custom = await readFile(join(f.rimeDir, "wanxiang.custom.yaml"), "utf8");
  assert.ok(custom.includes("# comment"));
  assert.ok(!custom.includes("meme_tips"));
  assert.equal(parse(custom).patch["switches/@10/reset"], 1);
});
test("1000-record derived index has exactly one name entry and all triggers", async (t) => {
  const f = await setup(t);
  const { meme } = await f.store.importImage(f.source, { name: "猫" });
  const memes = Array.from({ length: 1000 }, (_, i) => ({
    ...meme,
    name: `图片${i}`,
    triggers: [`image${i}`, `img${i}`],
  }));
  assert.equal(generateIndex(memes).trim().split("\n").length, 3000);
  assert.equal(new LocalSearchProvider().search("img999", memes).length, 1);
});
