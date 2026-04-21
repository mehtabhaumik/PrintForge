import Foundation
import React

@objc(PrintForgeShare)
class PrintForgeShare: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(getInitialSharedFile:rejecter:)
  func getInitialSharedFile(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    if let payload = SharedFileStore.shared.consumePayload() {
      resolve(payload)
    } else {
      resolve(NSNull())
    }
  }
}
