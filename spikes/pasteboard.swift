import AppKit
import Foundation

let out = URL(fileURLWithPath: CommandLine.arguments[1])
let image = NSImage(size: NSSize(width: 240, height: 240))
image.lockFocus()
NSColor(calibratedRed: 0.22, green: 0.45, blue: 0.82, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: 240, height: 240)).fill()
("MemeBoard\nPaste Test" as NSString).draw(
  at: NSPoint(x: 30, y: 90),
  withAttributes: [.font: NSFont.systemFont(ofSize: 24), .foregroundColor: NSColor.white])
image.unlockFocus()
let rep = NSBitmapImageRep(data: image.tiffRepresentation!)!
try rep.representation(using: .png, properties: [:])!.write(to: out)
let board = NSPasteboard.general
board.clearContents()
if CommandLine.arguments.contains("--file") {
  board.writeObjects([out as NSURL])
} else {
  let item = NSPasteboardItem()
  item.setData(try Data(contentsOf: out), forType: .png)
  board.writeObjects([item])
}
print("Pasteboard types: \(board.types?.map(\.rawValue) ?? [])")
