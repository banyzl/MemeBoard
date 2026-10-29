// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "MemeBoardHelper", platforms: [.macOS(.v13)],
  products: [.executable(name: "memeboard-helper", targets: ["MemeBoardHelper"])],
  targets: [
    .target(name: "MemeBoardClipboard"),
    .executableTarget(name: "MemeBoardHelper", dependencies: ["MemeBoardClipboard"]),
    .testTarget(name: "MemeBoardClipboardTests", dependencies: ["MemeBoardClipboard"]),
  ])
