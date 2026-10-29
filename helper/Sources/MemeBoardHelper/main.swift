import AppKit
import ApplicationServices
import Foundation
import MemeBoardClipboard

struct Record: Decodable {
  let id: String
  let fileName: String
}
struct Database: Decodable {
  let schemaVersion: Int
  let memes: [Record]
}
struct Reply: Encodable {
  let status: String
  let message: String
  let accessibility: Bool
  let postEvent: Bool
}
let fm = FileManager.default
let root = fm.homeDirectoryForCurrentUser.appendingPathComponent(
  "Library/Application Support/MemeBoard", isDirectory: true)
let permissionPage =
  ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 27
  ? "系统设置 → 隐私与安全 → 设备控制和数据访问" : "系统设置 → 隐私与安全性 → 辅助功能"
func emit(_ status: String, _ message: String, code: Int32 = 0) -> Never {
  let reply = Reply(
    status: status, message: message, accessibility: AXIsProcessTrusted(),
    postEvent: CGPreflightPostEventAccess())
  if let data = try? JSONEncoder().encode(reply) { print(String(decoding: data, as: UTF8.self)) }
  exit(code)
}
@MainActor func log(_ event: String) {
  let dir = root.appendingPathComponent("logs", isDirectory: true)
  try? fm.createDirectory(
    at: dir, withIntermediateDirectories: true, attributes: [.posixPermissions: 0o700])
  let file = dir.appendingPathComponent("helper.log")
  if let attrs = try? fm.attributesOfItem(atPath: file.path), let size = attrs[.size] as? NSNumber,
    size.intValue > 1_000_000
  {
    try? fm.removeItem(atPath: file.path + ".1")
    try? fm.moveItem(atPath: file.path, toPath: file.path + ".1")
  }
  if !fm.fileExists(atPath: file.path) {
    fm.createFile(atPath: file.path, contents: nil, attributes: [.posixPermissions: 0o600])
  }
  if let handle = try? FileHandle(forWritingTo: file) {
    defer { try? handle.close() }
    _ = try? handle.seekToEnd()
    try? handle.write(
      contentsOf: Data("\(ISO8601DateFormatter().string(from:Date())) \(event)\n".utf8))
  }
}
let args = Array(CommandLine.arguments.dropFirst())
if args == ["doctor"] {
  emit(
    "ready",
    (AXIsProcessTrusted() && CGPreflightPostEventAccess())
      ? "自动粘贴权限已开启" : "图片可复制；自动粘贴需要在\(permissionPage)中授权")
}
guard args.count == 2, ["paste", "copy"].contains(args[0]), UUID(uuidString: args[1]) != nil,
  args[1].range(
    of: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    options: .regularExpression) != nil
else { emit("error", "用法：memeboard-helper paste|copy <UUID>，或 doctor", code: 64) }
let id = args[1].lowercased()
do {
  let database = try JSONDecoder().decode(
    Database.self, from: Data(contentsOf: root.appendingPathComponent("database.json")))
  guard database.schemaVersion == 1 else { emit("error", "不支持的数据库版本", code: 65) }
  guard let meme = database.memes.first(where: { $0.id.lowercased() == id }) else {
    emit("error", "图片已不存在", code: 66)
  }
  let imageDir = root.appendingPathComponent("images", isDirectory: true).resolvingSymlinksInPath()
  let file = imageDir.appendingPathComponent(meme.fileName).resolvingSymlinksInPath()
  let ext = file.pathExtension.lowercased()
  guard file.deletingLastPathComponent() == imageDir,
    meme.fileName == "\(meme.id).\(ext)", ["png", "jpg", "jpeg", "webp", "gif"].contains(ext),
    let png = ImageClipboard.pngData(from: file)
  else { emit("error", "图片文件无效或无法解码", code: 65) }
  // Store PNG as the source representation; macOS may offer derived compatibility types.
  let targetApp = NSWorkspace.shared.frontmostApplication
  let target = targetApp?.processIdentifier
  let board = NSPasteboard.general
  guard ImageClipboard.writePNG(png, to: board) else {
    emit("error", "无法写入剪贴板", code: 74)
  }
  log("\(args[0]) \(id)")
  if args[0] == "paste" { log("target_app \(targetApp?.bundleIdentifier ?? "unknown")") }
  if args[0] == "copy" { emit("copied", "图片已复制") }
  guard AXIsProcessTrusted(), CGPreflightPostEventAccess() else {
    log("accessibility_or_post_event_missing")
    emit("copied", "图片已复制到剪贴板，请手动 ⌘V。自动粘贴需在\(permissionPage)中授权", code: 2)
  }
  let count = board.changeCount
  // The Rime composition must disappear before Cmd+V reaches the target editor.
  Thread.sleep(forTimeInterval: 0.16)
  guard let pid = target, NSWorkspace.shared.frontmostApplication?.processIdentifier == pid,
    board.changeCount == count,
    let source = CGEventSource(stateID: .privateState),
    let down = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: true),
    let up = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: false)
  else { emit("copied", "前台窗口或剪贴板已变化，图片已复制，请手动 ⌘V", code: 2) }
  down.flags = .maskCommand
  up.flags = .maskCommand
  // Emit the complete modifier/key sequence after verifying the foreground PID.
  // A short drain interval keeps this CLI alive until WindowServer consumes them.
  guard let commandDown = CGEvent(keyboardEventSource: source, virtualKey: 55, keyDown: true),
    let commandUp = CGEvent(keyboardEventSource: source, virtualKey: 55, keyDown: false)
  else { emit("copied", "图片已复制，请手动 ⌘V", code: 2) }
  commandDown.type = .flagsChanged
  commandDown.flags = .maskCommand
  commandUp.type = .flagsChanged
  commandUp.flags = []
  commandDown.post(tap: .cgSessionEventTap)
  Thread.sleep(forTimeInterval: 0.02)
  down.post(tap: .cgSessionEventTap)
  Thread.sleep(forTimeInterval: 0.04)
  up.post(tap: .cgSessionEventTap)
  commandUp.post(tap: .cgSessionEventTap)
  Thread.sleep(forTimeInterval: 0.12)
  log("paste_requested \(id)")
  emit("paste_requested", "已执行图片粘贴")
} catch {
  log("read_or_decode_failed")
  emit("error", "读取数据库或图片失败：\(error.localizedDescription)", code: 74)
}
