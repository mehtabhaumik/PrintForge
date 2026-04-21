import Foundation
import UniformTypeIdentifiers

class SharedFileStore {
  static let shared = SharedFileStore()

  private var fileURL: URL?

  private init() {}

  func setFileURL(_ url: URL) {
    fileURL = url
  }

  func consumePayload() -> [String: Any]? {
    guard let url = fileURL else {
      return nil
    }

    fileURL = nil
    let mimeType = mimeTypeFor(url)

    guard ["application/pdf", "image/jpeg", "image/png"].contains(mimeType) else {
      return nil
    }

    return [
      "uri": url.absoluteString,
      "name": url.lastPathComponent.isEmpty ? fallbackName(for: mimeType) : url.lastPathComponent,
      "type": mimeType,
      "size": fileSize(for: url) ?? NSNull(),
    ]
  }

  private func mimeTypeFor(_ url: URL) -> String {
    if let contentType = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType {
      if contentType.conforms(to: .pdf) {
        return "application/pdf"
      }

      if contentType.conforms(to: .jpeg) {
        return "image/jpeg"
      }

      if contentType.conforms(to: .png) {
        return "image/png"
      }
    }

    let lowerName = url.lastPathComponent.lowercased()

    if lowerName.hasSuffix(".pdf") {
      return "application/pdf"
    }

    if lowerName.hasSuffix(".jpg") || lowerName.hasSuffix(".jpeg") {
      return "image/jpeg"
    }

    if lowerName.hasSuffix(".png") {
      return "image/png"
    }

    return "application/octet-stream"
  }

  private func fileSize(for url: URL) -> Int? {
    guard let values = try? url.resourceValues(forKeys: [.fileSizeKey]) else {
      return nil
    }

    return values.fileSize
  }

  private func fallbackName(for mimeType: String) -> String {
    if mimeType == "application/pdf" {
      return "Shared PDF"
    }

    if mimeType == "image/jpeg" {
      return "Shared photo"
    }

    return "Shared image"
  }
}
