import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { installIntegration, removeIntegration } from "../raycast-extension/src/rime/installer";
const command = process.argv[2];
const rimeDir = join(homedir(), "Library/Rime");
const dataDir = join(homedir(), "Library/Application Support/MemeBoard");
async function main() {
  if (command === "install") {
    const backup = await installIntegration({ rimeDir, dataDir, assetsDir: resolve("assets") });
    console.log(
      JSON.stringify(
        {
          status: "installed",
          backup,
          rimeDir,
          helper: join(dataDir, "bin/memeboard-helper"),
          next: "首次安装后部署一次鼠须管；添加图片无需部署",
        },
        null,
        2,
      ),
    );
  } else if (command === "uninstall") {
    await removeIntegration(rimeDir);
    console.log("已移除 MemeBoard 配置。请部署一次鼠须管。图片资料库和备份均已保留。");
  } else throw new Error("使用 install 或 uninstall");
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
