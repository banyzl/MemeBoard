# MemeBoard

macOS 本地表情包资料库：使用 Raycast 导入、编辑和搜索图片，通过万象拼音提示快捷粘贴到 QQ 输入框。

MemeBoard V1 does not send meme data over the network.

所有图片、名称、快捷码、搜索词和日志均在本机处理。V1 没有 AI、在线搜索、分析服务或同步服务。开发安装时 npm 会联网下载公开依赖，使用表情包时不会联网。

## 当前状态

已实现 Raycast Extension、Swift CLI Helper、独立 Rime Lua 模块、安装/修复与卸载工具。本机两条 MVP 完整链路已通过：Raycast 选图 Enter 与 Rime 图片提示逗号均能把图片插入 QQ 输入框。最终插图由用户在 QQ 前台实际操作并确认。验证依据与其他待验证范围见 [测试结果](docs/测试结果.md)。

## 快速开始

```sh
git clone https://github.com/banyzl/MemeBoard.git
cd MemeBoard
make setup
make check
make build
make dev
```

首次使用再从 Raycast 运行 **Install / Repair Rime Integration**，并重新部署一次鼠须管。
源码仓库不包含本机可执行文件；`make build` 会生成当前 Mac 架构的 Helper 与扩展资源。

## 项目结构

```text
MemeBoard/
├── raycast-extension/  # 管理界面、数据层、搜索与安装器
├── helper/             # Swift 原生粘贴 CLI
├── rime/               # 独立 Lua 模块与配置示例
├── shared/schema/      # 数据格式定义
├── tests/              # 单元测试、Lua 测试与合成图片
├── spikes/             # 本机技术验证程序
├── scripts/            # 构建、安装与集成测试入口
└── docs/               # 需求说明、数据格式与实际验收记录
```

开发说明见 [CONTRIBUTING.md](CONTRIBUTING.md)，版本记录见 [CHANGELOG.md](CHANGELOG.md)。

## 使用方式

构建并加载扩展后，Raycast 提供以下命令：

- **Add Meme**：选择图片，填写名称。快捷码留空时自动生成完整拼音和不冲突的首字母缩写。
- **Search Memes**：五列、等比、contain 图片网格；搜索名称、别名、标签或快捷码。
- **Install / Repair Rime Integration**：备份后安装或修复鼠须管集成。
- **MemeBoard: Test QQ Image Paste**：仅用于比较 Raycast 原生文件粘贴行为的诊断命令。

在 Raycast Settings → Extensions 中找到 Search Memes，可自行设置全局快捷键，例如 `⌥E`。本项目不修改你已有的全局快捷键。

选中图片后：

| 操作                         | 按键  |
| ---------------------------- | ----- |
| 粘贴图片到之前的前台应用     | Enter |
| 只复制原生图片               | ⌘C    |
| 编辑名称、别名、标签、快捷码 | ⌘E    |
| Quick Look                   | Space |
| 添加图片                     | ⌘N    |
| 刷新列表                     | ⌘R    |
| 删除，须二次确认             | ⌘⇧D   |

导入会**复制**原文件；源文件之后被删除不影响资料库。支持 PNG、JPEG/JPG、WebP 和 GIF，单个文件上限 50 MB。GIF 当前按静态图片处理，动画保留未实现。

## Rime 图片提示与发送按键

首次安装或更新 Lua 模块之后，需要重新部署鼠须管一次。之后新增、编辑和删除图片只更新 TSV 与版本文件，不需要重新部署。输入变化时最多每秒检查一次版本，成功发布的索引通常在下一次输入更新时生效；输入法空闲时没有后台定时器。

例如图片名称为「猫猫无语」，自动快捷码为 `maomaowuyu`、`mmwy`：

- 第一页优先匹配完整 raw input，再匹配当前高亮候选的文本。
- 后续页只匹配当前高亮候选。
- 使用候选匹配时，不要求输入完整拼音；高亮候选一旦匹配名称，即可出现图片提示。
- 别名与标签用于 Raycast 搜索，不参与 Rime 名称匹配。

按键沿用原版 Super Tips 的配置。本机原版使用逗号：

```text
只有图片提示：
〔🖼️ 猫猫无语 · ,〕
, → 粘贴图片

同时命中原版提示：
〔Emoji：😂〕 〔🖼️ 猫猫无语 · ;〕
, → 原版 Super Tips
; → 图片
```

**以图片提示里标注的按键为准。** 两者同时存在时保留原版按键的行为，避免显示图片却意外提交普通提示。可在 `wanxiang.custom.yaml` 的 patch 中调整：

```yaml
patch:
  memeboard:
    meme_key: comma
    fallback_key: semicolon
```

如果希望图片始终用分号，改为 `meme_key: semicolon`。可选任何 Rime 支持的 KeyEvent 表示，例如 `Control+semicolon`。修改按键配置后部署一次。图片提示默认跟随 `super_tips` 开关；Ctrl+T 的习惯保留。不命中图片时不会拦截按键，也不改变候选顺序。

## 自动粘贴权限

Helper 只写剪贴板并模拟 `⌘V`，不会自动按 Enter，也不会点击聊天发送按钮。Helper 会同时检查辅助控制与 PostEvent 权限。

本机当前 macOS 的入口是：

**系统设置 → 隐私与安全 → 设备控制和数据访问**

部分 macOS 版本显示为：**隐私与安全性 → 辅助功能**。它与侧栏的「无障碍」入口不同。

点「添加」，按 `⌘⇧G`，粘贴以下路径并添加、开启：

```text
~/Library/Application Support/MemeBoard/bin/memeboard-helper
```

系统可能要求用户认证。此授权需由用户完成。若子进程归属于 Raycast 或鼠须管，系统也可能按启动应用的身份显示权限；请以系统实际提示为准。鼠须管路径为 `/Library/Input Methods/Squirrel.app`。检查命令：

```sh
"$HOME/Library/Application Support/MemeBoard/bin/memeboard-helper" doctor
```

权限缺失时，图片仍会复制；Raycast 提示手动 `⌘V`。从 Rime 调用时不会弹出抢焦点的窗口，可手动 `⌘V` 并查看 `helper.log` 中的 `accessibility_or_post_event_missing`。前台应用或剪贴板在等待期间变化时，Helper 也会退回只复制，避免向错误窗口粘贴。

## 开发安装

要求 macOS 13+、Raycast、鼠须管与万象拼音、Node.js 22+，以及提供 Swift 6+ 编译器的 Xcode Command Line Tools。

```sh
cd raycast-extension
npm ci
npm run prepare-assets
npm run typecheck
npm test
npm run build
npm run dev
```

`prepare-assets` 构建 Swift release helper，并将 Helper 与 Lua 复制到扩展 assets。Raycast 运行时不需要 Swift 编译器。生成文件不提交到 Git；请在使用扩展的目标机器上构建，Intel Mac 与 Apple Silicon 均使用相同步骤。

运行安装命令或 Raycast 的 Install / Repair Rime Integration：

```sh
cd raycast-extension
npm run install-rime
```

安装器会：

1. 读取本机**已部署**的万象 processors 和 Super Tips 按键。
2. 备份 custom 配置、已存在的 MemeBoard Lua 与 Helper，记录上游 hash。
3. 安装 `lua/meme_tips.lua`、Helper 和索引。
4. 使用 YAML patch 把两个独立入口放在 Super Tips 前后，保留其他 custom 设置和注释。

不修改官方 `wanxiang.schema.yaml`、`super_tips.lua`、loader 或 `tips_show.txt`。碰到同位置的既有用户 processor patch 会明确失败，不覆盖它。默认安装 `wanxiang`，其他方案需要调整安装器参数并重新验证。

完成后，在鼠须管菜单选「重新部署」。也可以使用鼠须管官方维护接口：

```sh
"/Library/Input Methods/Squirrel.app/Contents/MacOS/Squirrel" --reload
```

## 万象更新后的修复

更新万象并完成其正常部署后，运行 **Install / Repair Rime Integration**，再部署一次。修复会根据新的已部署 processor 列表重新定位 Super Tips，并刷新独立模块。现有图片资料库保留。

备份保存在：

```text
~/Library/Application Support/MemeBoard/backups/<时间与随机标识>/
```

其中 `manifest.json` 记录备份文件对应路径、Super Tips 与部署后 schema 的 SHA-256。配置损坏时先使用备份修复，勿把旧备份直接覆盖到含有新改动的 custom 文件。

## 卸载

```sh
cd raycast-extension
npm run uninstall-rime
```

卸载工具先备份 custom，再只移除 MemeBoard 的 processor patch 和配置，保留其他用户设置。之后部署一次鼠须管，并在 Raycast Settings → Extensions 中移除 MemeBoard 开发扩展。卸载不删除图片、回收目录、日志或备份，独立 Lua 与 Helper 也保留用于回滚，但 Rime 不再加载其入口。

如需清理这些文件，可在确认保留所需图片后，将以下目录或文件移入废纸篓：

```text
~/Library/Application Support/MemeBoard/
~/Library/Rime/memeboard/
~/Library/Rime/lua/meme_tips.lua
```

## 数据和日志

```text
~/Library/Application Support/MemeBoard/
├── database.json
├── images/<UUID>.<扩展名>
├── bin/memeboard-helper
├── backups/
├── integration.json
├── trash/<UUID>.<扩展名> 与 <UUID>.json
└── logs/raycast.log、helper.log

~/Library/Rime/memeboard/
├── index.tsv
└── version
```

没有运行中必需的 `config.json`；当前配置由 Raycast preferences 与 Rime 的 memeboard patch 管理。数据格式见 [数据格式](docs/数据格式.md)。所有关键文本与导入图片用临时文件、fsync、rename 写入；写入互斥锁避免并发命令丢失记录。数据库提交成功但派生索引失败时，会明确提示索引待修复并保留原数据。

删除操作先保存可恢复的元数据，再提交数据库和索引，图片移至 `trash`。这不是数据库内的自动撤销功能；手动恢复需同时恢复元数据和图片，并重新生成索引。日志只写事件、UUID 与排障所需的应用 bundle ID，不记录聊天内容、名称或搜索词；单个日志超过约 1 MB 时保留一份轮替文件。

## 验证

```sh
cd raycast-extension
npm test
npm run typecheck
npm run build
cd ..
python3 spikes/lua-run.py tests/rime.test.lua
./scripts/test-rime-engine.sh
```

后两项使用已安装鼠须管所附的 Lua/librime；真实引擎测试只在临时目录创建测试 schema，不修改用户方案。真实界面验收记录见 [测试结果](docs/测试结果.md)。

## 已知限制

- QQ 的普通聊天编辑区可识别原生图片，QQ「我的手机」入口走文件传输流程。
- 生产路径将原始剪贴板项写为 PNG，不再额外写入 TIFF。macOS 仍可能自动提供 TIFF 兼容转换，读取整个剪贴板的可用类型不能代表原始存储格式。`Clipboard.paste({file})` 的初次测试受自动化前台焦点影响，尚不能认定其在 QQ 中的兼容性。
- GIF 动画保留未实现；WebP 与 JPEG 需分别验收，见测试结果。
- Helper 模拟粘贴返回成功只说明系统接收了按键；并不能单凭返回值判断目标软件已成功插图，需要界面验收。
- 系统权限与前台焦点变化可能让自动粘贴退回只复制。
- 原版与图片提示同时存在时，必须使用图片标注的备用键；原版按键保持原行为。
- 万象改变 notification 生命周期或 patch 机制后，需要重新运行兼容测试。
- 没有后台服务或 LaunchAgent，Helper 只在明确的图片操作时启动。

技术依据：[Raycast Clipboard](https://developers.raycast.com/api-reference/clipboard)、[Raycast Grid](https://developers.raycast.com/api-reference/user-interface/grid)、[librime 接口](https://github.com/rime/librime/blob/1.16.0/src/rime_api.h)、本机万象 v18.1.7 的源码。

## 许可证

原始代码采用 [MIT License](LICENSE)。第三方 API 头文件与依赖说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 剪贴板 PNG / TIFF 格式

MemeBoard 仅在明确复制或粘贴图片时写入剪贴板，不监听截图、不改写系统截图设置。
从 0.1.1 起，Helper 的原始剪贴板项只存储 `public.png`，诊断程序也不再直接写入 NSImage（该方式会产生 TIFF）。

macOS 可能为 PNG 自动提供 TIFF 兼容转换：`NSPasteboard.types` 中出现 TIFF，并不表示原始项被写成 TIFF。
项目回归测试同时检查原始项只含 PNG，以及原生图像读取仍然可用。

Raycast 自带 Clipboard History 对历史条目使用什么格式是其自身行为。已保存为 TIFF 的旧条目不会被本次修复重写；
可在条目的 `⌘K` 操作菜单中选择 **Paste as PNG**，这是 [Raycast 官方提供的操作](https://manual.raycast.com/clipboard-history)。
该项目没有新增全局截图格式设置、剪贴板监听器或自动图片转换服务。

原生剪贴板回归测试使用独立命名的测试剪贴板，不改动用户当前剪贴板：

```sh
make check-helper
```
