import AppKit
import Foundation

/// Native image conversion with one explicit external representation: PNG.
@MainActor
public enum ImageClipboard {
  private static let pngSignature = Data([137, 80, 78, 71, 13, 10, 26, 10])

  public static func pngData(from file: URL) -> Data? {
    guard let image = NSImage(contentsOf: file), let decoded = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: decoded)
    else { return nil }
    // TIFF is only an in-memory decoding intermediate. It must never be advertised.
    return bitmap.representation(using: .png, properties: [:])
  }

  @discardableResult
  public static func writePNG(_ data: Data, to board: NSPasteboard) -> Bool {
    guard data.starts(with: pngSignature) else { return false }
    let item = NSPasteboardItem()
    guard item.setData(data, forType: .png) else { return false }
    board.clearContents()
    // Do not write NSImage objects: their native pasteboard representation is TIFF.
    return board.writeObjects([item])
  }
}
