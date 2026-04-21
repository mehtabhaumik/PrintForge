import Foundation
import UIKit
import React

@objc(SystemPrint)
class SystemPrint: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }

  @objc(printFile:resolver:rejecter:)
  func printFile(
    _ request: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let startedAt = Date()
      guard
        let fileUri = request["fileUri"] as? String,
        let fileName = request["fileName"] as? String,
        let url = URL(string: fileUri)
      else {
        resolve(self.result(
          startedAt: startedAt,
          status: "failed",
          message: "We need a file before opening the system print dialog.",
          errorCode: "PRINT_INVALID_INPUT"
        ))
        return
      }

      guard UIPrintInteractionController.canPrint(url) else {
        resolve(self.result(
          startedAt: startedAt,
          status: "failed",
          message: "iOS cannot print this file yet. Try a PDF, JPG, or PNG.",
          errorCode: "UNSUPPORTED_FORMAT"
        ))
        return
      }

      let printInfo = UIPrintInfo(dictionary: nil)
      printInfo.jobName = fileName
      printInfo.outputType = self.outputType(for: request["mimeType"] as? String)
      let options = request["options"] as? NSDictionary
      printInfo.duplex = self.duplexMode(for: options)
      if let orientation = self.orientation(for: options) {
        printInfo.orientation = orientation
      }

      let controller = UIPrintInteractionController.shared
      controller.printInfo = printInfo
      controller.printingItem = url
      controller.present(animated: true) { _, completed, error in
        if completed {
          resolve(self.result(
            startedAt: startedAt,
            status: "completed",
            message: "System print dialog completed.",
            errorCode: nil
          ))
          return
        }

        if error != nil {
          resolve(self.result(
            startedAt: startedAt,
            status: "failed",
            message: "We could not open the iOS print dialog. Try again.",
            errorCode: "PRINT_FAILED"
          ))
          return
        }

        resolve(self.result(
          startedAt: startedAt,
          status: "failed",
          message: "Print was cancelled.",
          errorCode: "PRINT_FAILED"
        ))
      }
    }
  }

  private func outputType(for mimeType: String?) -> UIPrintInfo.OutputType {
    if mimeType == "image/jpeg" || mimeType == "image/png" {
      return .photo
    }

    return .general
  }

  private func duplexMode(for options: NSDictionary?) -> UIPrintInfo.Duplex {
    let duplex = options?["duplex"] as? String

    if duplex == "long-edge" {
      return .longEdge
    }

    if duplex == "short-edge" {
      return .shortEdge
    }

    return .none
  }

  private func orientation(for options: NSDictionary?) -> UIPrintInfo.Orientation? {
    let orientation = options?["orientation"] as? String

    if orientation == "portrait" {
      return .portrait
    }

    if orientation == "landscape" {
      return .landscape
    }

    return nil
  }

  private func result(
    startedAt: Date,
    status: String,
    message: String,
    errorCode: String?
  ) -> [String: Any] {
    var payload: [String: Any] = [
      "jobId": "system-\(Int(startedAt.timeIntervalSince1970 * 1000))",
      "status": status,
      "protocolUsed": "SYSTEM",
      "attempts": 1,
      "latencyMs": max(0, Int(Date().timeIntervalSince(startedAt) * 1000)),
      "message": message,
    ]
    payload["errorCode"] = errorCode ?? NSNull()
    return payload
  }
}
