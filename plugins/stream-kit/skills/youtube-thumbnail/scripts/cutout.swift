import Foundation
import Vision
import CoreImage
import AppKit

// Cut the foreground person out of an image using Vision's foreground instance
// mask (macOS 14+). Runs entirely on-device.
let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: cutout <in.png> <out.png>\n".data(using: .utf8)!)
    exit(2)
}
let inURL = URL(fileURLWithPath: args[1])
let outURL = URL(fileURLWithPath: args[2])

guard let ciImage = CIImage(contentsOf: inURL) else {
    FileHandle.standardError.write("could not read input\n".data(using: .utf8)!)
    exit(1)
}

let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: ciImage, options: [:])

do {
    try handler.perform([request])
    guard let result = request.results?.first else {
        FileHandle.standardError.write("no foreground instance found\n".data(using: .utf8)!)
        exit(1)
    }
    let pixelBuffer = try result.generateMaskedImage(
        ofInstances: result.allInstances,
        from: handler,
        croppedToInstancesExtent: true
    )
    let masked = CIImage(cvPixelBuffer: pixelBuffer)
    let context = CIContext()
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { exit(1) }
    try context.writePNGRepresentation(
        of: masked,
        to: outURL,
        format: .RGBA8,
        colorSpace: colorSpace
    )
    print("wrote \(outURL.path) instances=\(result.allInstances.count)")
} catch {
    FileHandle.standardError.write("vision failed: \(error)\n".data(using: .utf8)!)
    exit(1)
}
