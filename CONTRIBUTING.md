# 开发与贡献

## 环境与入口

- TypeScript 数据层测试：Node.js 22+，npm。
- 构建和使用扩展：macOS 13+、Raycast、Swift 6+。
- 本机 Rime 集成测试：已安装鼠须管与万象，默认用户目录为 `~/Library/Rime`。

在仓库根目录执行：

```sh
make setup
make check
make build
make dev
```

`make check` 包含格式检查、类型检查和数据/搜索/安装器测试。
`make build` 会编译 Helper，并将 Helper、Lua 和诊断 PNG 复制到 Raycast assets；
这些生成文件不提交到 Git。代码格式可用 `make format` 统一。

## 模块边界

- `raycast-extension/src/storage/`：canonical JSON、原子写入、图片导入、唯一性与索引。
- `raycast-extension/src/search/`：本地搜索接口；Grid 使用 Raycast 原生 fuzzy filtering。
- `raycast-extension/src/rime/`：保留用户 custom 配置的安装/修复工具。
- `rime/meme_tips.lua`：独立的 Rime 提示与按键处理模块。
- `helper/`：只接受 UUID 的原生图片剪贴板与粘贴 CLI。
- `tests/`：可独立运行的数据层测试、Lua 回归测试及合成图片。
- `spikes/`：独立技术验证程序；不用于生产运行。

## 验证集成

```sh
make check-rime
make check-helper
```

测试使用本机 Squirrel 所附动态库，所有测试 schema 和索引均创建在临时目录。
完整 QQ 链路还需要在真实前台输入框手动验收，不能仅凭模拟按键调用成功判断插图成功。
更改 Lua、按键或 Prompt 逻辑时，需同时验证普通 Super Tips 的 Emoji、翻译、化学式与符号。

## 提交原则

- 不提交 `~/Library/Application Support/MemeBoard` 的数据库、图片、日志或备份。
- 不提交本机 Rime 配置、上游万象数据或编译目录。
- 保持 UUID 稳定、名称和 trigger 全局唯一，冲突时明确拒绝。
- 不在 V1 引入联网图片处理、AI、遥测或常驻服务。
- 改变数据格式时增加显式版本和迁移策略。

CI 检查 TypeScript、格式、Swift 编译与原生剪贴板回归测试。需要本机鼠须管和 QQ 的验收不能由 CI 替代，
请在提交说明中注明实际测试环境与尚未验证的部分。
