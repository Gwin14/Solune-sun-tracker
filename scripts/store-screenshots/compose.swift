// Composes App Store screenshots: a caption over the app's night-sky gradient
// with the real screen capture inside a phone silhouette.
// Run: swift scripts/store-screenshots/compose.swift scripts/store-screenshots/shots.json
//
// Output is 1320 × 2868 (iPhone 6.9"), RGB without alpha, which App Store
// Connect accepts and scales down for the smaller iPhone sizes.

import AppKit
import Foundation

struct Shot: Decodable {
  let input: String
  let output: String
  let title: String
  let subtitle: String
  let island: Bool?
}

let W = 1320, H = 2868

func color(_ hex: String, _ a: CGFloat = 1) -> CGColor {
  let v = UInt32(hex.dropFirst(), radix: 16)!
  return CGColor(
    srgbRed: CGFloat((v >> 16) & 0xff) / 255, green: CGFloat((v >> 8) & 0xff) / 255,
    blue: CGFloat(v & 0xff) / 255, alpha: a)
}

func draw(_ shot: Shot, base: URL) throws {
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let ctx = CGContext(
    data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: space,
    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
  // Flip so y grows downwards, like a screen.
  ctx.translateBy(x: 0, y: CGFloat(H))
  ctx.scaleBy(x: 1, y: -1)

  // Sky: the app's zenith → twilight keyframes.
  let sky = CGGradient(
    colorsSpace: space,
    colors: [color("#05081A"), color("#0B1043"), color("#272A78"), color("#4A3F92")] as CFArray,
    locations: [0, 0.35, 0.78, 1])!
  ctx.drawLinearGradient(sky, start: .zero, end: CGPoint(x: 0, y: H), options: [])

  // A soft warm glow behind the phone, low in the frame.
  let glow = CGGradient(
    colorsSpace: space, colors: [color("#FFB86B", 0.22), color("#FFB86B", 0)] as CFArray,
    locations: [0, 1])!
  ctx.drawRadialGradient(
    glow, startCenter: CGPoint(x: W / 2, y: 1500), startRadius: 0,
    endCenter: CGPoint(x: W / 2, y: 1500), endRadius: 900, options: [])

  // A few faint stars in the caption area.
  var seed: UInt64 = UInt64(abs(shot.title.hashValue) % 1000) + 7
  func rnd() -> CGFloat {
    seed = seed &* 6364136223846793005 &+ 1442695040888963407
    return CGFloat(seed >> 33) / CGFloat(1 << 31)
  }
  for _ in 0..<70 {
    let x = rnd() * CGFloat(W), y = rnd() * 640, r = 1.2 + rnd() * 2.2
    ctx.setFillColor(color("#F4F2FF", 0.25 + rnd() * 0.45))
    ctx.fillEllipse(in: CGRect(x: x, y: y, width: r, height: r))
  }

  // Caption.
  let ns = NSGraphicsContext(cgContext: ctx, flipped: true)
  NSGraphicsContext.current = ns
  let para = NSMutableParagraphStyle()
  para.alignment = .center
  para.lineHeightMultiple = 0.95
  let title = NSAttributedString(
    string: shot.title,
    attributes: [
      .font: NSFont.systemFont(ofSize: 112, weight: .bold),
      .foregroundColor: NSColor.white,
      .paragraphStyle: para,
      .kern: -1.5,
    ])
  let sub = NSAttributedString(
    string: shot.subtitle,
    attributes: [
      .font: NSFont.systemFont(ofSize: 54, weight: .regular),
      .foregroundColor: NSColor(white: 1, alpha: 0.72),
      .paragraphStyle: para,
    ])
  let textW: CGFloat = 1160
  let tRect = title.boundingRect(
    with: NSSize(width: textW, height: 600), options: [.usesLineFragmentOrigin])
  let sRect = sub.boundingRect(
    with: NSSize(width: textW, height: 400), options: [.usesLineFragmentOrigin])
  let top: CGFloat = 170
  title.draw(
    with: NSRect(x: (CGFloat(W) - textW) / 2, y: top, width: textW, height: tRect.height),
    options: [.usesLineFragmentOrigin])
  sub.draw(
    with: NSRect(
      x: (CGFloat(W) - textW) / 2, y: top + tRect.height + 34, width: textW, height: sRect.height),
    options: [.usesLineFragmentOrigin])
  NSGraphicsContext.current = nil

  // Phone.
  let src = base.appendingPathComponent(shot.input)
  guard let img = NSImage(contentsOf: src)?.cgImage(forProposedRect: nil, context: nil, hints: nil)
  else { throw NSError(domain: "compose", code: 1, userInfo: [NSLocalizedDescriptionKey: "no image \(src.path)"]) }
  let screenW: CGFloat = 1000
  let scale = screenW / 1320
  let screenH = 2868 * scale
  let bezel: CGFloat = 22
  let x = (CGFloat(W) - screenW) / 2
  let y: CGFloat = 640
  let body = CGRect(x: x - bezel, y: y - bezel, width: screenW + bezel * 2, height: screenH + bezel * 2)
  let bodyPath = CGPath(roundedRect: body, cornerWidth: 150, cornerHeight: 150, transform: nil)

  ctx.saveGState()
  ctx.setShadow(offset: CGSize(width: 0, height: 40), blur: 120, color: color("#000000", 0.55))
  ctx.addPath(bodyPath)
  ctx.setFillColor(color("#0E1020"))
  ctx.fillPath()
  ctx.restoreGState()
  // Hairline edge on the frame.
  ctx.addPath(bodyPath)
  ctx.setStrokeColor(color("#FFFFFF", 0.16))
  ctx.setLineWidth(3)
  ctx.strokePath()

  let screen = CGRect(x: x, y: y, width: screenW, height: screenH)
  ctx.saveGState()
  ctx.addPath(CGPath(roundedRect: screen, cornerWidth: 130, cornerHeight: 130, transform: nil))
  ctx.clip()
  // Undo the flip for the bitmap so it isn't drawn upside down.
  ctx.translateBy(x: 0, y: screen.maxY + screen.minY)
  ctx.scaleBy(x: 1, y: -1)
  ctx.interpolationQuality = .high
  ctx.draw(img, in: screen)
  ctx.restoreGState()

  if shot.island ?? true {
    let iw = 375 * scale, ih = 112 * scale
    let island = CGRect(x: CGFloat(W) / 2 - iw / 2, y: y + 38 * scale, width: iw, height: ih)
    ctx.addPath(CGPath(roundedRect: island, cornerWidth: ih / 2, cornerHeight: ih / 2, transform: nil))
    ctx.setFillColor(color("#000000"))
    ctx.fillPath()
  }

  let out = base.appendingPathComponent(shot.output)
  try FileManager.default.createDirectory(
    at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
  let dest = CGImageDestinationCreateWithURL(out as CFURL, "public.png" as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
  CGImageDestinationFinalize(dest)
  print("✓ \(shot.output)")
}

let cfg = URL(fileURLWithPath: CommandLine.arguments[1])
let shots = try JSONDecoder().decode([Shot].self, from: Data(contentsOf: cfg))
for s in shots { try draw(s, base: cfg.deletingLastPathComponent()) }
