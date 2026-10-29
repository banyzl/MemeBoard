import AppKit
import ApplicationServices
import Foundation

print(
  "accessibility=\(AXIsProcessTrusted()), postEvent=\(CGPreflightPostEventAccess()), frontmost=\(NSWorkspace.shared.frontmostApplication?.bundleIdentifier ?? "unknown")"
)
