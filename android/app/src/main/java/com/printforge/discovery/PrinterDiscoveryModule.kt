package com.printforge.discovery

import android.content.Context
import android.net.DhcpInfo
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.net.Inet4Address
import java.net.InetSocketAddress
import java.net.NetworkInterface
import java.net.Socket
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.Semaphore
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class PrinterDiscoveryModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newCachedThreadPool()
  private val nsdManager by lazy {
    reactContext.getSystemService(Context.NSD_SERVICE) as NsdManager
  }
  private val wifiManager by lazy {
    reactContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
  }

  override fun getName(): String = "PrinterDiscovery"

  @ReactMethod
  fun getAvailablePrinters(promise: Promise) {
    executor.execute {
      val discovered = ConcurrentHashMap<String, DiscoveredPrinter>()
      val completed = AtomicBoolean(false)
      val multicastLock = wifiManager.createMulticastLock("PrintForgePrinterDiscovery").apply {
        setReferenceCounted(false)
      }

      try {
        logPattern("discovery_started", null)
        safelyAcquireMulticastLock(multicastLock)

        val mdnsThread = Thread {
          discoverMdns(discovered, completed)
        }
        val scanThread = Thread {
          scanSubnet(discovered, completed)
        }

        mdnsThread.start()
        scanThread.start()
        mdnsThread.join(MDNS_TOTAL_TIMEOUT_MS + 750L)
        scanThread.join(IP_SCAN_TOTAL_TIMEOUT_MS + 1000L)

        completed.set(true)

        val finalPrinters = discovered.values
          .sortedWith(compareByDescending<DiscoveredPrinter> { it.source == "MDNS" }.thenBy { it.ip })

        logPattern("discovery_finished", "count=${finalPrinters.size}")
        promise.resolve(finalPrinters.toWritableArray())
      } catch (error: Exception) {
        completed.set(true)
        logPattern("discovery_failed", error.message)
        promise.reject("PRINTER_DISCOVERY_FAILED", friendlyDiscoveryError(), error)
      } finally {
        safelyReleaseMulticastLock(multicastLock)
      }
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required for NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required for NativeEventEmitter.
  }

  private fun discoverMdns(
    discovered: ConcurrentHashMap<String, DiscoveredPrinter>,
    completed: AtomicBoolean,
  ) {
    val listeners = mutableListOf<NsdManager.DiscoveryListener>()

    MDNS_SERVICE_TYPES.forEach { serviceType ->
      val listener = createDiscoveryListener(serviceType, discovered, completed)
      listeners.add(listener)

      try {
        nsdManager.discoverServices(serviceType, NsdManager.PROTOCOL_DNS_SD, listener)
      } catch (error: Exception) {
        logPattern("mdns_start_failed", "${serviceType}: ${error.message}")
      }
    }

    sleep(MDNS_TOTAL_TIMEOUT_MS)
    listeners.forEach { listener ->
      try {
        nsdManager.stopServiceDiscovery(listener)
      } catch (error: Exception) {
        logPattern("mdns_stop_failed", error.message)
      }
    }
  }

  private fun createDiscoveryListener(
    serviceType: String,
    discovered: ConcurrentHashMap<String, DiscoveredPrinter>,
    completed: AtomicBoolean,
  ): NsdManager.DiscoveryListener {
    return object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(regType: String) {
        logPattern("mdns_started", regType)
      }

      override fun onServiceFound(serviceInfo: NsdServiceInfo) {
        if (completed.get()) {
          return
        }

        if (!MDNS_SERVICE_TYPES.any { serviceInfo.serviceType.contains(it, ignoreCase = true) }) {
          return
        }

        resolveMdnsService(serviceInfo, serviceType, discovered, completed)
      }

      override fun onServiceLost(serviceInfo: NsdServiceInfo) {
        logPattern("mdns_lost", serviceInfo.serviceName)
      }

      override fun onDiscoveryStopped(serviceType: String) {
        logPattern("mdns_stopped", serviceType)
      }

      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
        logPattern("mdns_start_failed", "$serviceType code=$errorCode")
        safeStopDiscovery(this)
      }

      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {
        logPattern("mdns_stop_failed", "$serviceType code=$errorCode")
        safeStopDiscovery(this)
      }
    }
  }

  private fun resolveMdnsService(
    serviceInfo: NsdServiceInfo,
    serviceType: String,
    discovered: ConcurrentHashMap<String, DiscoveredPrinter>,
    completed: AtomicBoolean,
  ) {
    val resolver = object : NsdManager.ResolveListener {
      override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
        logPattern("mdns_resolve_failed", "${serviceInfo.serviceName} code=$errorCode")
      }

      override fun onServiceResolved(resolvedService: NsdServiceInfo) {
        if (completed.get()) {
          return
        }

        val host = resolvedService.host?.hostAddress ?: return
        val port = resolvedService.port.takeIf { it > 0 } ?: defaultPortForService(serviceType)
        val printer = DiscoveredPrinter(
          id = createPrinterId(host, port),
          name = resolvedService.serviceName.takeIf { it.isNotBlank() } ?: "Printer at $host",
          ip = host,
          port = port,
          protocolHint = protocolHintFor(serviceType, port),
          source = "MDNS",
        )

        upsertPrinter(discovered, printer)
      }
    }

    try {
      nsdManager.resolveService(serviceInfo, resolver)
    } catch (error: Exception) {
      logPattern("mdns_resolve_exception", "${serviceInfo.serviceName}: ${error.message}")
    }
  }

  private fun scanSubnet(
    discovered: ConcurrentHashMap<String, DiscoveredPrinter>,
    completed: AtomicBoolean,
  ) {
    val subnet = detectIpv4Subnet()

    if (subnet == null) {
      logPattern("ip_scan_skipped", "subnet_unavailable")
      return
    }

    logPattern("ip_scan_started", subnet)
    val throttle = Semaphore(IP_SCAN_PARALLELISM)
    val tasks = mutableListOf<java.util.concurrent.Future<*>>()
    val scanPool = Executors.newFixedThreadPool(IP_SCAN_PARALLELISM)

    try {
      for (host in 1..254) {
        if (completed.get()) {
          break
        }

        val ip = "$subnet.$host"
        for (port in IP_SCAN_PORTS) {
          throttle.acquire()
          tasks.add(
            scanPool.submit {
              try {
                if (!completed.get() && isPortOpen(ip, port)) {
                  val printer = DiscoveredPrinter(
                    id = createPrinterId(ip, port),
                    name = "Printer at $ip",
                    ip = ip,
                    port = port,
                    protocolHint = protocolHintFor(null, port),
                    source = "IP_SCAN",
                  )
                  upsertPrinter(discovered, printer)
                }
              } finally {
                throttle.release()
              }
            },
          )
        }
      }

      val deadline = System.currentTimeMillis() + IP_SCAN_TOTAL_TIMEOUT_MS
      tasks.forEach { task ->
        val remainingMs = deadline - System.currentTimeMillis()
        if (remainingMs <= 0) {
          return@forEach
        }

        try {
          task.get(remainingMs.coerceAtMost(IP_SCAN_SOCKET_TIMEOUT_MS + 200L), TimeUnit.MILLISECONDS)
        } catch (_: Exception) {
          task.cancel(true)
        }
      }
    } catch (error: Exception) {
      logPattern("ip_scan_failed", error.message)
    } finally {
      scanPool.shutdownNow()
      logPattern("ip_scan_finished", "count=${discovered.size}")
    }
  }

  private fun isPortOpen(ip: String, port: Int): Boolean {
    return try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(ip, port), IP_SCAN_SOCKET_TIMEOUT_MS)
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun upsertPrinter(
    discovered: ConcurrentHashMap<String, DiscoveredPrinter>,
    printer: DiscoveredPrinter,
  ) {
    val existing = discovered[printer.ip]
    val winner = chooseBetterPrinter(existing, printer)
    discovered[printer.ip] = winner
    emitPrinterFound(winner)
    logPattern("printer_found", "${winner.source}:${winner.ip}:${winner.port}:${winner.protocolHint}")
  }

  private fun chooseBetterPrinter(
    existing: DiscoveredPrinter?,
    candidate: DiscoveredPrinter,
  ): DiscoveredPrinter {
    if (existing == null) {
      return candidate
    }

    if (existing.source != "MDNS" && candidate.source == "MDNS") {
      return candidate
    }

    if (existing.protocolHint == "UNKNOWN" && candidate.protocolHint != "UNKNOWN") {
      return candidate
    }

    if (existing.protocolHint == "RAW" && candidate.protocolHint == "IPP") {
      return candidate
    }

    if (existing.name.startsWith("Printer at") && !candidate.name.startsWith("Printer at")) {
      return candidate
    }

    return existing
  }

  private fun emitPrinterFound(printer: DiscoveredPrinter) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(PRINTER_FOUND_EVENT, printer.toWritableMap())
  }

  private fun detectIpv4Subnet(): String? {
    return detectWifiDhcpSubnet() ?: detectNetworkInterfaceSubnet()
  }

  private fun detectWifiDhcpSubnet(): String? {
    return try {
      val dhcpInfo: DhcpInfo = wifiManager.dhcpInfo ?: return null
      ipv4SubnetFromLittleEndianAddress(dhcpInfo.ipAddress)
    } catch (error: Exception) {
      logPattern("wifi_subnet_detection_failed", error.message)
      null
    }
  }

  private fun detectNetworkInterfaceSubnet(): String? {
    return try {
      NetworkInterface.getNetworkInterfaces()
        .asSequence()
        .filter { networkInterface ->
          networkInterface.isUp && !networkInterface.isLoopback && !networkInterface.isVirtual
        }
        .flatMap { networkInterface -> networkInterface.inetAddresses.asSequence() }
        .filterIsInstance<Inet4Address>()
        .mapNotNull { address -> ipv4SubnetFromAddress(address.hostAddress) }
        .firstOrNull()
    } catch (error: Exception) {
      logPattern("interface_subnet_detection_failed", error.message)
      null
    }
  }

  private fun ipv4SubnetFromLittleEndianAddress(ipAddress: Int): String? {
    if (ipAddress == 0) {
      return null
    }

    val first = ipAddress and 0xff
    val second = ipAddress shr 8 and 0xff
    val third = ipAddress shr 16 and 0xff

    return "$first.$second.$third"
  }

  private fun ipv4SubnetFromAddress(address: String?): String? {
    val parts = address
      ?.split(".")
      ?.takeIf { it.size == 4 }
      ?: return null

    return parts.take(3).joinToString(".")
  }

  private fun protocolHintFor(serviceType: String?, port: Int): String {
    if (serviceType?.contains("_ipp._tcp", ignoreCase = true) == true || port == 631) {
      return "IPP"
    }

    if (port == 9100) {
      return "RAW"
    }

    return "UNKNOWN"
  }

  private fun defaultPortForService(serviceType: String): Int {
    return if (serviceType.contains("_ipp._tcp", ignoreCase = true)) 631 else 9100
  }

  private fun createPrinterId(ip: String, port: Int): String {
    val input = "$ip:$port"
    val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
    return digest.take(12).joinToString("") { "%02x".format(it) }
  }

  private fun safeStopDiscovery(listener: NsdManager.DiscoveryListener) {
    try {
      nsdManager.stopServiceDiscovery(listener)
    } catch (_: Exception) {
      // Ignore: Android can throw if discovery has already stopped.
    }
  }

  private fun safelyAcquireMulticastLock(lock: WifiManager.MulticastLock) {
    try {
      lock.acquire()
    } catch (error: Exception) {
      logPattern("multicast_lock_failed", error.message)
    }
  }

  private fun safelyReleaseMulticastLock(lock: WifiManager.MulticastLock) {
    try {
      if (lock.isHeld) {
        lock.release()
      }
    } catch (error: Exception) {
      logPattern("multicast_release_failed", error.message)
    }
  }

  private fun sleep(milliseconds: Long) {
    try {
      Thread.sleep(milliseconds)
    } catch (_: InterruptedException) {
      Thread.currentThread().interrupt()
    }
  }

  private fun friendlyDiscoveryError(): String {
    return "We could not scan the network right now. Make sure Wi-Fi is on and try again."
  }

  private fun logPattern(event: String, detail: String?) {
    Log.d(LOG_TAG, if (detail == null) event else "$event · $detail")
  }

  private fun List<DiscoveredPrinter>.toWritableArray(): WritableArray {
    val array = Arguments.createArray()
    forEach { printer -> array.pushMap(printer.toWritableMap()) }
    return array
  }

  private fun DiscoveredPrinter.toWritableMap(): WritableMap {
    return Arguments.createMap().apply {
      putString("id", id)
      putString("name", name)
      putString("ip", ip)
      putInt("port", port)
      putString("protocolHint", protocolHint)
      putString("source", source)
    }
  }

  private data class DiscoveredPrinter(
    val id: String,
    val name: String,
    val ip: String,
    val port: Int,
    val protocolHint: String,
    val source: String,
  )

  companion object {
    private const val LOG_TAG = "PrintForgeDiscovery"
    private const val PRINTER_FOUND_EVENT = "PrintForgePrinterFound"
    private const val MDNS_TOTAL_TIMEOUT_MS = 6500L
    private const val IP_SCAN_TOTAL_TIMEOUT_MS = 9000L
    private const val IP_SCAN_SOCKET_TIMEOUT_MS = 450
    private const val IP_SCAN_PARALLELISM = 32
    private val MDNS_SERVICE_TYPES = listOf("_ipp._tcp.", "_printer._tcp.")
    private val IP_SCAN_PORTS = listOf(631, 9100)
  }
}
