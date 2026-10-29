import AppKit
import Foundation

for path in CommandLine.arguments.dropFirst() {
  guard let image = NSImage(contentsOfFile: path), let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let png = bitmap.representation(using: .png, properties: [:])
  else {
    fputs("FAIL decode \(URL(fileURLWithPath:path).lastPathComponent)\n", stderr)
    exit(1)
  }
  print(
    "PASS native decode \(URL(fileURLWithPath:path).pathExtension): \(bitmap.pixelsWide)x\(bitmap.pixelsHigh), PNG \(png.count) bytes"
  )
}
