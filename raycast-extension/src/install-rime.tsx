import { Action, ActionPanel, Detail, environment, showToast, Toast } from "@raycast/api";
import { useState } from "react";
import { installIntegration } from "./rime/installer";
import { store } from "./settings";
export default function Command() {
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<string>();
  async function install() {
    setBusy(true);
    try {
      const db = store();
      setBackup(
        await installIntegration({
          rimeDir: db.rimeDir,
          dataDir: db.root,
          assetsDir: environment.assetsPath,
        }),
      );
      await showToast(Toast.Style.Success, "安装完成", "请部署一次鼠须管以加载 Lua 模块");
    } catch (error) {
      await showToast(Toast.Style.Failure, "安装失败", (error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Detail
      isLoading={busy}
      markdown={`# 安装 / 修复 Rime 集成\n\n仅支持本机万象拼音。安装前自动备份已有配置，保留其他自定义设置。\n\n- 安装独立 Lua 模块与 Helper\n- 同步图片索引\n- 图片提示优先使用与原版相同的逗号\n- 同时命中原版提示时，图片旁会标出备用键\n\n首次安装或更新 Lua 后，请通过鼠须管菜单「重新部署」部署一次。之后添加、编辑或删除图片无需部署。\n\n自动粘贴需要在「系统设置 → 隐私与安全 → 设备控制和数据访问（旧版本称为辅助功能）」中授权。权限未开启时图片仍会复制，可手动 ⌘V。${backup ? `\n\n已备份到：\n\n\`${backup}\`` : ""}`}
      actions={
        <ActionPanel>
          <Action title="安装 / 修复" onAction={install} />
          <Action.Open title="打开 Rime 目录" target={store().rimeDir} />
          <Action.Open title="打开数据目录" target={store().root} />
        </ActionPanel>
      }
    />
  );
}
