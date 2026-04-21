package com.printforge.capability

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.io.BufferedInputStream
import java.net.InetSocketAddress
import java.net.Socket
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager

class PrinterCapabilityModule(
  reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newCachedThreadPool()

  override fun getName(): String = "PrinterCapability"

  @ReactMethod
  fun getPrinterCapabilities(ip: String, selectedPort: Double, promise: Promise) {
    executor.execute {
      val startedAt = System.currentTimeMillis()

      if (ip.isBlank()) {
        promise.reject(
          "PRINTER_CAPABILITY_INVALID_INPUT",
          "We could not check this printer because its address is missing.",
        )
        return@execute
      }

      try {
        logPattern("capability_check_started", "$ip:${selectedPort.toInt()}")

        val probes = runParallelProbes(ip, selectedPort.toInt())
        val ippAvailable = probes.any { it.kind == ProbeKind.IPP && it.available }
        val rawAvailable = probes.any { it.kind == ProbeKind.RAW && it.available }
        val httpAvailable = probes.any { it.kind == ProbeKind.HTTP && it.available }
        val esclProbe = probes.firstOrNull { it.kind == ProbeKind.ESCL && it.available }
        val airScanProbe = probes.firstOrNull { it.kind == ProbeKind.AIRSCAN && it.available }
        val scannerDetected = esclProbe != null || airScanProbe != null
        val supportedProtocols = mutableListOf<String>()
        val scanProtocols = mutableListOf<String>()

        if (ippAvailable) {
          supportedProtocols.add("IPP")
        }

        if (rawAvailable) {
          supportedProtocols.add("RAW")
        }

        if (esclProbe != null) {
          scanProtocols.add("ESCL")
        }

        if (airScanProbe != null) {
          scanProtocols.add("AIRSCAN")
        }

        if (httpAvailable && scanProtocols.isEmpty()) {
          scanProtocols.add("HTTP")
        }

        val status = when {
          ippAvailable -> "READY"
          rawAvailable -> "LIMITED"
          else -> "UNREACHABLE"
        }
        val scannerStatus = when {
          scannerDetected -> "DETECTED"
          httpAvailable -> "NEEDS_SETUP"
          ippAvailable || rawAvailable -> "NOT_DETECTED"
          else -> "UNKNOWN"
        }

        val capability = PrinterCapabilities(
          canPrint = ippAvailable || rawAvailable,
          supportedProtocols = supportedProtocols,
          canScan = scannerDetected,
          scannerStatus = scannerStatus,
          scanProtocols = scanProtocols,
          scanEndpoint = esclProbe?.endpoint ?: airScanProbe?.endpoint,
          canFax = false,
          status = status,
          latencyMs = (System.currentTimeMillis() - startedAt).coerceAtLeast(0L),
        )

        logPattern(
          "capability_check_finished",
          "$ip status=${capability.status} protocols=${supportedProtocols.joinToString(",")}",
        )
        promise.resolve(capability.toWritableMap())
      } catch (error: Exception) {
        logPattern("capability_check_failed", "$ip ${error.message}")
        promise.resolve(
          PrinterCapabilities(
            canPrint = false,
            supportedProtocols = emptyList(),
            canScan = false,
            scannerStatus = "UNKNOWN",
            scanProtocols = emptyList(),
            scanEndpoint = null,
            canFax = false,
            status = "UNREACHABLE",
            latencyMs = (System.currentTimeMillis() - startedAt).coerceAtLeast(0L),
          ).toWritableMap(),
        )
      }
    }
  }

  private fun runParallelProbes(ip: String, selectedPort: Int): List<ProbeResult> {
    val probePool = Executors.newFixedThreadPool(PROBE_PARALLELISM)
    val tasks = mutableListOf(
      Callable { checkIpp(ip, IPP_PORT) },
      Callable { checkRaw(ip) },
      Callable { checkHttp(ip, HTTP_PORT, secure = false) },
      Callable { checkHttp(ip, HTTPS_PORT, secure = true) },
      Callable { checkScannerEndpoint(ip, HTTP_PORT, ESCL_CAPABILITIES_PATH, secure = false, ProbeKind.ESCL) },
      Callable { checkScannerEndpoint(ip, HTTPS_PORT, ESCL_CAPABILITIES_PATH, secure = true, ProbeKind.ESCL) },
      Callable { checkScannerEndpoint(ip, HTTP_PORT, AIRSCAN_ROOT_PATH, secure = false, ProbeKind.AIRSCAN) },
      Callable { checkScannerEndpoint(ip, HTTPS_PORT, AIRSCAN_ROOT_PATH, secure = true, ProbeKind.AIRSCAN) },
    )

    if (selectedPort.isValidTcpPort() && selectedPort !in DEFAULT_PROBE_PORTS) {
      tasks.add(Callable { checkIpp(ip, selectedPort) })
    }

    return try {
      probePool
        .invokeAll(tasks, PROBE_TIMEOUT_MS + PROBE_GRACE_MS, TimeUnit.MILLISECONDS)
        .mapNotNull { future ->
          try {
            if (future.isCancelled) null else future.get(1, TimeUnit.MILLISECONDS)
          } catch (_: Exception) {
            null
          }
        }
    } finally {
      probePool.shutdownNow()
    }
  }

  private fun checkIpp(ip: String, port: Int): ProbeResult {
    return measureProbe(ProbeKind.IPP) {
      validateHttpResponse(ip, port, secure = false)
    }
  }

  private fun checkRaw(ip: String): ProbeResult {
    return measureProbe(ProbeKind.RAW) {
      canOpenTcpSocket(ip, RAW_PORT)
    }
  }

  private fun checkHttp(ip: String, port: Int, secure: Boolean): ProbeResult {
    return measureProbe(ProbeKind.HTTP) {
      validateHttpResponse(ip, port, secure)
    }
  }

  private fun checkScannerEndpoint(
    ip: String,
    port: Int,
    path: String,
    secure: Boolean,
    kind: ProbeKind,
  ): ProbeResult {
    val endpoint = "${if (secure) "https" else "http"}://$ip:$port$path"

    return measureProbe(kind, endpoint) {
      validateHttpResponse(ip, port, secure, "GET", path, acceptedStatuses = setOf(200, 401, 403))
    }
  }

  private fun validateHttpResponse(
    ip: String,
    port: Int,
    secure: Boolean,
    method: String = "HEAD",
    path: String = "/",
    acceptedStatuses: Set<Int> = (200..499).toSet(),
  ): Boolean {
    val socket = if (secure) {
      sslContext.socketFactory.createSocket() as Socket
    } else {
      Socket()
    }

    return socket.use { activeSocket ->
      activeSocket.connect(InetSocketAddress(ip, port), PROBE_TIMEOUT_MS.toInt())
      activeSocket.soTimeout = PROBE_TIMEOUT_MS.toInt()
      activeSocket.getOutputStream().write(
        "$method $path HTTP/1.1\r\nHost: $ip\r\nConnection: close\r\n\r\n".toByteArray(Charsets.US_ASCII),
      )
      activeSocket.getOutputStream().flush()

      val buffer = ByteArray(HTTP_RESPONSE_BYTES)
      val readCount = BufferedInputStream(activeSocket.getInputStream()).read(buffer)
      if (readCount <= 0) {
        return@use false
      }

      val responsePrefix = String(buffer, 0, readCount, Charsets.US_ASCII)
      if (!responsePrefix.startsWith("HTTP/")) {
        return@use false
      }

      val statusCode = responsePrefix
        .lineSequence()
        .firstOrNull()
        ?.split(" ")
        ?.getOrNull(1)
        ?.toIntOrNull()

      statusCode != null && acceptedStatuses.contains(statusCode)
    }
  }

  private fun canOpenTcpSocket(ip: String, port: Int): Boolean {
    return try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(ip, port), PROBE_TIMEOUT_MS.toInt())
      }
      true
    } catch (_: Exception) {
      false
    }
  }

  private fun Int.isValidTcpPort(): Boolean {
    return this in 1..65535
  }

  private fun measureProbe(kind: ProbeKind, endpoint: String? = null, probe: () -> Boolean): ProbeResult {
    val startedAt = System.currentTimeMillis()
    val available = try {
      probe()
    } catch (_: Exception) {
      false
    }
    val latencyMs = (System.currentTimeMillis() - startedAt).coerceAtLeast(0L)
    logPattern("probe_finished", "$kind available=$available latencyMs=$latencyMs")

    return ProbeResult(kind, available, latencyMs, endpoint)
  }

  private fun PrinterCapabilities.toWritableMap(): WritableMap {
    return Arguments.createMap().apply {
      putBoolean("canPrint", canPrint)
      putArray("supportedProtocols", supportedProtocols.toWritableArray())
      putBoolean("canScan", canScan)
      putString("scannerStatus", scannerStatus)
      putArray("scanProtocols", scanProtocols.toWritableArray())
      if (scanEndpoint != null) {
        putString("scanEndpoint", scanEndpoint)
      }
      putBoolean("canFax", canFax)
      putString("status", status)
      putInt("latencyMs", latencyMs.toInt())
    }
  }

  private fun List<String>.toWritableArray(): WritableArray {
    val array = Arguments.createArray()
    forEach { item -> array.pushString(item) }
    return array
  }

  private fun logPattern(event: String, detail: String?) {
    Log.d(LOG_TAG, if (detail == null) event else "$event · $detail")
  }

  private enum class ProbeKind {
    IPP,
    RAW,
    HTTP,
    ESCL,
    AIRSCAN,
  }

  private data class ProbeResult(
    val kind: ProbeKind,
    val available: Boolean,
    val latencyMs: Long,
    val endpoint: String? = null,
  )

  private data class PrinterCapabilities(
    val canPrint: Boolean,
    val supportedProtocols: List<String>,
    val canScan: Boolean,
    val scannerStatus: String,
    val scanProtocols: List<String>,
    val scanEndpoint: String?,
    val canFax: Boolean,
    val status: String,
    val latencyMs: Long,
  )

  companion object {
    private const val LOG_TAG = "PrintForgeCapability"
    private const val IPP_PORT = 631
    private const val RAW_PORT = 9100
    private const val HTTP_PORT = 80
    private const val HTTPS_PORT = 443
    private const val ESCL_CAPABILITIES_PATH = "/eSCL/ScannerCapabilities"
    private const val AIRSCAN_ROOT_PATH = "/eSCL/"
    private const val PROBE_TIMEOUT_MS = 3000L
    private const val PROBE_GRACE_MS = 250L
    private const val PROBE_PARALLELISM = 8
    private const val HTTP_RESPONSE_BYTES = 96
    private val DEFAULT_PROBE_PORTS = setOf(IPP_PORT, RAW_PORT, HTTP_PORT, HTTPS_PORT)

    private val sslContext: SSLContext by lazy {
      val trustManagers = arrayOf<TrustManager>(
        object : X509TrustManager {
          override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
          override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) = Unit
          override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
        },
      )

      SSLContext.getInstance("TLS").apply {
        init(null, trustManagers, SecureRandom())
      }
    }
  }
}
