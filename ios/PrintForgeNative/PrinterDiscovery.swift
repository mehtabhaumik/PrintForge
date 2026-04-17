import Foundation
import Darwin
import React

@objc(PrinterDiscovery)
class PrinterDiscovery: RCTEventEmitter, NetServiceBrowserDelegate, NetServiceDelegate {
  private let serviceTypes = [
    "_ipp._tcp.",
    "_printer._tcp.",
    "_ipps._tcp.",
    "_scanner._tcp.",
    "_uscan._tcp.",
    "_uscans._tcp.",
  ]
  private var browsers: [NetServiceBrowser] = []
  private var resolvingServices: [NetService] = []
  private var discoveredPrinters: [String: [String: Any]] = [:]
  private var resolveBlock: RCTPromiseResolveBlock?
  private var timeoutWorkItem: DispatchWorkItem?

  override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["PrintForgePrinterFound"]
  }

  @objc(getAvailablePrinters:rejecter:)
  func getAvailablePrinters(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.finishDiscovery()
      self.resolveBlock = resolve
      self.discoveredPrinters = [:]

      self.browsers = self.serviceTypes.map { serviceType in
        let browser = NetServiceBrowser()
        browser.delegate = self
        browser.searchForServices(ofType: serviceType, inDomain: "local.")
        return browser
      }

      let timeout = DispatchWorkItem { [weak self] in
        self?.finishDiscovery()
      }
      self.timeoutWorkItem = timeout
      DispatchQueue.main.asyncAfter(deadline: .now() + 7.0, execute: timeout)
    }
  }

  func netServiceBrowser(
    _ browser: NetServiceBrowser,
    didFind service: NetService,
    moreComing: Bool
  ) {
    service.delegate = self
    resolvingServices.append(service)
    service.resolve(withTimeout: 3.0)
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard let printer = printerPayload(from: sender) else {
      removeResolvingService(sender)
      return
    }

    let id = printer["id"] as? String ?? UUID().uuidString
    discoveredPrinters[id] = printer
    sendEvent(withName: "PrintForgePrinterFound", body: printer)
    removeResolvingService(sender)
  }

  func netService(
    _ sender: NetService,
    didNotResolve errorDict: [String: NSNumber]
  ) {
    removeResolvingService(sender)
  }

  private func finishDiscovery() {
    timeoutWorkItem?.cancel()
    timeoutWorkItem = nil

    browsers.forEach { $0.stop() }
    browsers = []
    resolvingServices.forEach { $0.stop() }
    resolvingServices = []

    guard let resolve = resolveBlock else {
      return
    }

    resolveBlock = nil
    resolve(Array(discoveredPrinters.values))
  }

  private func removeResolvingService(_ service: NetService) {
    resolvingServices.removeAll { $0 === service }
  }

  private func printerPayload(from service: NetService) -> [String: Any]? {
    guard let ip = service.addresses?.compactMap(ipAddress(from:)).first else {
      return nil
    }

    let port = service.port > 0 ? service.port : inferredPort(for: service.type)
    let protocolHint = inferredProtocol(for: service.type, port: port)
    let id = "ios-\(ip.replacingOccurrences(of: ".", with: "-"))-\(port)"

    return [
      "id": id,
      "name": service.name.isEmpty ? "Printer at \(ip)" : service.name,
      "ip": ip,
      "port": port,
      "protocolHint": protocolHint,
      "source": "MDNS",
    ]
  }

  private func inferredPort(for type: String) -> Int {
    if type.contains("_printer") {
      return 9100
    }

    return 631
  }

  private func inferredProtocol(for type: String, port: Int) -> String {
    if type.contains("_ipp") || port == 631 {
      return "IPP"
    }

    if type.contains("_printer") || port == 9100 {
      return "RAW"
    }

    return "UNKNOWN"
  }

  private func ipAddress(from data: Data) -> String? {
    return data.withUnsafeBytes { pointer -> String? in
      guard let baseAddress = pointer.baseAddress else {
        return nil
      }

      let socketAddress = baseAddress.assumingMemoryBound(to: sockaddr.self)

      if socketAddress.pointee.sa_family == sa_family_t(AF_INET) {
        var address = baseAddress.assumingMemoryBound(to: sockaddr_in.self).pointee.sin_addr
        var buffer = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
        inet_ntop(AF_INET, &address, &buffer, socklen_t(INET_ADDRSTRLEN))
        return String(cString: buffer)
      }

      if socketAddress.pointee.sa_family == sa_family_t(AF_INET6) {
        var address = baseAddress.assumingMemoryBound(to: sockaddr_in6.self).pointee.sin6_addr
        var buffer = [CChar](repeating: 0, count: Int(INET6_ADDRSTRLEN))
        inet_ntop(AF_INET6, &address, &buffer, socklen_t(INET6_ADDRSTRLEN))
        return String(cString: buffer)
      }

      return nil
    }
  }
}
