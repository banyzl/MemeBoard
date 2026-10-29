import AppKit
import Foundation
import MemeBoardClipboard
import Testing

@MainActor
struct ImageClipboardTests {
  private var fixtures: URL {
    var directory = URL(fileURLWithPath: #filePath)
    for _ in 0..<4 { directory.deleteLastPathComponent() }
    return directory.appendingPathComponent("tests/fixtures")
  }

  @Test
  func supportedImagesNormalizeToPNG() throws {
    for ext in ["png", "jpg", "webp", "gif"] {
      let data = try #require(
        ImageClipboard.pngData(from: fixtures.appendingPathComponent("paste-test.\(ext)")))
      #expect(data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]))
      let bitmap = try #require(NSBitmapImageRep(data: data))
      #expect(bitmap.pixelsWide > 0)
      #expect(bitmap.pixelsHigh > 0)
    }
  }

  @Test
  func storedClipboardItemContainsPNGWithoutTIFFOrFileRepresentation() throws {
    let board = NSPasteboard.withUniqueName()
    defer { board.releaseGlobally() }
    let data = try #require(
      ImageClipboard.pngData(from: fixtures.appendingPathComponent("paste-test.png")))
    #expect(ImageClipboard.writePNG(data, to: board))
    let items = try #require(board.pasteboardItems)
    #expect(items.count == 1)
    let stored = try #require(items.first)
    #expect(stored.types == [.png])
    #expect(stored.data(forType: .png) == data)
    #expect(stored.data(forType: .tiff) == nil)
    #expect(stored.data(forType: .fileURL) == nil)
    // macOS can synthesize TIFF at board level; that is not a stored source format.
    #expect(board.types?.contains(.png) == true)
    #expect(NSImage(pasteboard: board) != nil)
  }

  @Test
  func invalidPayloadDoesNotReplaceClipboard() {
    let board = NSPasteboard.withUniqueName()
    defer { board.releaseGlobally() }
    board.setString("keep existing clipboard", forType: .string)
    let previousChange = board.changeCount
    #expect(!ImageClipboard.writePNG(Data("not an image".utf8), to: board))
    #expect(board.changeCount == previousChange)
    #expect(board.string(forType: .string) == "keep existing clipboard")
  }

  @Test
  func missingOrInvalidImageDoesNotDecode() throws {
    #expect(ImageClipboard.pngData(from: fixtures.appendingPathComponent("missing.png")) == nil)
    let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: directory) }
    let file = directory.appendingPathComponent("invalid.png")
    try Data("not an image".utf8).write(to: file)
    #expect(ImageClipboard.pngData(from: file) == nil)
  }
}
