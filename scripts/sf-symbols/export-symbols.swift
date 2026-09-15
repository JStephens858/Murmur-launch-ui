// Exports SF Symbol outlines as SVG path data.
//
// Apple ships SF Symbols as vector glyphs inside CoreGlyphs, not as a font, so
// there is no public API that hands back their paths. AppKit's private
// NSSymbolImageRep does expose one — `outlinePath`, an NSBezierPath in 2× point
// units — and that is what this uses. It has been stable for years but it is
// private: if a macOS update removes it, this prints NOPATH and the committed
// components/portal/icons.tsx simply stops being regenerable until fixed.
// The path comes back y-down already (unlike most of AppKit), so it is used
// as-is with its origin moved to the top-left of its bounds.
//
// usage: swiftc -O export-symbols.swift -o export && ./export <outdir> name[:weight] ...
// Writes <outdir>/<name>-<weight>.json: { width, height, capHeight, baseline, d }
// in path units with the origin at the top-left. build-icons.py drives this.
import AppKit
import ObjectiveC

setlinebuf(stdout)
let args = CommandLine.arguments
guard args.count >= 3 else {
  print("usage: export <outdir> name[:weight] ...")
  exit(2)
}
let outDir = args[1]

func fmt(_ v: CGFloat) -> String {
  let s = String(format: "%.3f", v)
  return s.replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression)
}

for spec in args.dropFirst(2) {
  let parts = spec.split(separator: ":").map(String.init)
  let name = parts[0]
  let weightName = parts.count > 1 ? parts[1] : "regular"
  let weight: NSFont.Weight
  switch weightName {
  case "bold": weight = .bold
  case "semibold": weight = .semibold
  case "medium": weight = .medium
  default: weight = .regular
  }
  guard let image = NSImage(systemSymbolName: name, accessibilityDescription: nil)?
    .withSymbolConfiguration(.init(pointSize: 100, weight: weight, scale: .medium))
  else { print("MISSING \(name)"); exit(1) }
  let rep = image.representations[0] as NSObject
  guard let path = rep.perform(NSSelectorFromString("outlinePath"))?.takeUnretainedValue() as? NSBezierPath,
        let glyph = rep.perform(NSSelectorFromString("vectorGlyph"))?.takeUnretainedValue() as? NSObject,
        let cap = glyph.value(forKey: "capHeight") as? CGFloat,
        let baseline = glyph.value(forKey: "baselineOffset") as? CGFloat,
        let scale = glyph.value(forKey: "scale") as? CGFloat
  else { print("NOPATH \(name)"); exit(1) }

  let bounds = path.bounds
  let top = bounds.minY
  let left = bounds.minX
  var d = ""
  var pts = [NSPoint](repeating: .zero, count: 3)
  func pt(_ p: NSPoint) -> String { "\(fmt(p.x - left)) \(fmt(p.y - top))" }
  for i in 0..<path.elementCount {
    switch path.element(at: i, associatedPoints: &pts) {
    case .moveTo: d += "M" + pt(pts[0])
    case .lineTo: d += "L" + pt(pts[0])
    case .curveTo: d += "C" + pt(pts[0]) + " " + pt(pts[1]) + " " + pt(pts[2])
    case .closePath: d += "Z"
    default: d += "L" + pt(pts[0])
    }
  }
  let json = """
  {"name":"\(name)","weight":"\(weightName)","width":\(fmt(bounds.width)),"height":\(fmt(bounds.height)),"capHeight":\(fmt(cap * scale)),"baseline":\(fmt(baseline * scale)),"d":"\(d)"}
  """
  try! json.write(toFile: "\(outDir)/\(name)-\(weightName).json", atomically: true, encoding: String.Encoding.utf8)
  print("\(name):\(weightName) \(fmt(bounds.width))x\(fmt(bounds.height))")
}
