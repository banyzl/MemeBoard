import { closeMainWindow, environment, showHUD } from "@raycast/api";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { UUID_PATTERN } from "./storage/models";
import { store } from "./settings";
const exec = promisify(execFile);
export async function pasteMeme(id: string, copy = false): Promise<void> {
  if (!UUID_PATTERN.test(id)) throw new Error("无效的图片 ID");
  let helper = join(store().root, "bin/memeboard-helper");
  try {
    await access(helper);
  } catch {
    helper = join(environment.assetsPath, "memeboard-helper");
  }
  if (!copy) await closeMainWindow({ clearRootSearch: true });
  try {
    const { stdout } = await exec(helper, [copy ? "copy" : "paste", id], { timeout: 5000 });
    const result = JSON.parse(stdout);
    await showHUD(result.message);
  } catch (error) {
    const output = (error as { stdout?: string }).stdout;
    if (output) {
      try {
        const result = JSON.parse(output);
        await showHUD(result.message);
        return;
      } catch {}
    }
    await showHUD("图片操作失败，请先运行安装 / 修复 Rime 集成");
    await store()
      .log("helper_failed")
      .catch(() => {});
  }
}
