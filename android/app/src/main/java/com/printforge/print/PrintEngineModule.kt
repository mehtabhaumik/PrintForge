package com.printforge.print

import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.io.BufferedInputStream
import java.io.BufferedOutputStream
import java.io.ByteArrayOutputStream
import java.io.FileNotFoundException
import java.net.ConnectException
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.net.URL
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class PrintEngineModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newCachedThreadPool()

  override fun getName(): String = "PrintEngine"

  @ReactMethod
  fun submitPrintJob(request: ReadableMap, promise: Promise) {
    executor.execute {
      val startedAt = System.currentTimeMillis()
      val jobRequest = try {
        PrintJobRequest.fromReadableMap(request)
      } catch (error: PrintEngineException) {
        promise.resolve(error.toResult(startedAt).toWritableMap())
        return@execute
      }

      logPattern(
        "print_attempt_started",
        "${jobRequest.protocol}:${jobRequest.ip}:${jobRequest.port}:${jobRequest.fileName}",
      )

      var lastError: PrintEngineException? = null

      for (attempt in 1..MAX_ATTEMPTS) {
        try {
          when (jobRequest.protocol) {
            PrintProtocol.IPP -> sendIppJob(jobRequest)
            PrintProtocol.RAW -> sendRawJob(jobRequest)
          }

          val result = PrintEngineResult(
            jobId = createJobId(jobRequest, startedAt),
            status = "completed",
            protocolUsed = jobRequest.protocol.name,
            attempts = attempt,
            latencyMs = elapsedSince(startedAt),
            message = "Print sent. The printer will start when it is ready.",
            errorCode = null,
          )
          logPattern("print_attempt_finished", "success attempts=$attempt")
          promise.resolve(result.toWritableMap())
          return@execute
        } catch (error: PrintEngineException) {
          lastError = error
          logPattern("print_attempt_failed", "attempt=$attempt code=${error.code} detail=${error.message}")

          if (!error.retryable || attempt == MAX_ATTEMPTS) {
            break
          }
        }
      }

      val failure = lastError ?: PrintEngineException(
        code = "PRINT_FAILED",
        friendlyMessage = "We could not send this print. Please try again.",
      )
      promise.resolve(failure.toResult(startedAt, jobRequest).toWritableMap())
    }
  }

  @ReactMethod
  fun submitTestPrintJob(request: ReadableMap, promise: Promise) {
    executor.execute {
      val startedAt = System.currentTimeMillis()
      val jobRequest = try {
        TestPrintJobRequest.fromReadableMap(request)
      } catch (error: PrintEngineException) {
        promise.resolve(error.toResult(startedAt).toWritableMap())
        return@execute
      }
      val payload = createTestPrintPayload(jobRequest)
      var lastError: PrintEngineException? = null

      logPattern(
        "test_print_attempt_started",
        "${jobRequest.protocol}:${jobRequest.ip}:${jobRequest.port}",
      )

      for (attempt in 1..MAX_ATTEMPTS) {
        try {
          when (jobRequest.protocol) {
            PrintProtocol.IPP -> sendIppBytes(
              ip = jobRequest.ip,
              port = jobRequest.port,
              fileName = "PrintForge test page",
              mimeType = payload.mimeType,
              bytes = payload.bytes,
            )
            PrintProtocol.RAW -> sendRawBytes(
              ip = jobRequest.ip,
              port = jobRequest.port,
              bytes = payload.bytes,
            )
          }

          val result = PrintEngineResult(
            jobId = createJobId(jobRequest.ip, jobRequest.port, "test-page", startedAt),
            status = "completed",
            protocolUsed = jobRequest.protocol.name,
            attempts = attempt,
            latencyMs = elapsedSince(startedAt),
            message = "Test page sent. The printer will start when it is ready.",
            errorCode = null,
          )
          logPattern("test_print_attempt_finished", "success attempts=$attempt")
          promise.resolve(result.toWritableMap())
          return@execute
        } catch (error: PrintEngineException) {
          lastError = error
          logPattern("test_print_attempt_failed", "attempt=$attempt code=${error.code} detail=${error.message}")

          if (!error.retryable || attempt == MAX_ATTEMPTS) {
            break
          }
        }
      }

      val failure = lastError ?: PrintEngineException(
        code = "PRINT_FAILED",
        friendlyMessage = "We could not send the test page. Please try again.",
      )
      promise.resolve(
        PrintEngineResult(
          jobId = createJobId(jobRequest.ip, jobRequest.port, "test-page", startedAt),
          status = "failed",
          protocolUsed = jobRequest.protocol.name,
          attempts = MAX_ATTEMPTS,
          latencyMs = elapsedSince(startedAt),
          message = failure.friendlyMessage,
          errorCode = failure.code,
        ).toWritableMap(),
      )
    }
  }

  private fun sendIppJob(request: PrintJobRequest) {
    validateReadableFile(request)
    var lastFailure: PrintEngineException? = null

    for (path in IPP_PATHS) {
      val connection = try {
        val url = URL("http", request.ip, request.port, path)
        (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = CONNECT_TIMEOUT_MS
          readTimeout = READ_TIMEOUT_MS
          doOutput = true
          doInput = true
          useCaches = false
          setRequestProperty("Content-Type", "application/ipp")
          setRequestProperty("Accept", "application/ipp")
          setRequestProperty("Connection", "close")
        }
      } catch (error: Exception) {
        throw classifyError(error)
      }

      try {
        connection.outputStream.use { output ->
          BufferedOutputStream(output).use { bufferedOutput ->
            bufferedOutput.write(
              createIppPrintJobHeader(
                ip = request.ip,
                port = request.port,
                fileName = request.fileName,
                mimeType = request.mimeType,
                path = path,
              ),
            )
            openFileStream(request.fileUri).use { input ->
              input.copyTo(bufferedOutput)
            }
            bufferedOutput.flush()
          }
        }

        validateIppResponse(connection)
        return
      } catch (error: PrintEngineException) {
        lastFailure = error
        if (error.code != "PRINTER_REJECTED") {
          throw error
        }
      } catch (error: Exception) {
        throw classifyError(error)
      } finally {
        connection.disconnect()
      }
    }

    throw lastFailure ?: PrintEngineException(
      code = "PRINTER_REJECTED",
      friendlyMessage = "The printer rejected the print request.",
      retryable = false,
    )
  }

  private fun sendIppBytes(
    ip: String,
    port: Int,
    fileName: String,
    mimeType: String,
    bytes: ByteArray,
  ) {
    var lastFailure: PrintEngineException? = null

    for (path in IPP_PATHS) {
      val connection = try {
        val url = URL("http", ip, port, path)
        (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "POST"
          connectTimeout = CONNECT_TIMEOUT_MS
          readTimeout = READ_TIMEOUT_MS
          doOutput = true
          doInput = true
          useCaches = false
          setRequestProperty("Content-Type", "application/ipp")
          setRequestProperty("Accept", "application/ipp")
          setRequestProperty("Connection", "close")
        }
      } catch (error: Exception) {
        throw classifyError(error)
      }

      try {
        connection.outputStream.use { output ->
          BufferedOutputStream(output).use { bufferedOutput ->
            bufferedOutput.write(createIppPrintJobHeader(ip, port, fileName, mimeType, path))
            bufferedOutput.write(bytes)
            bufferedOutput.flush()
          }
        }

        validateIppResponse(connection)
        return
      } catch (error: PrintEngineException) {
        lastFailure = error
        if (error.code != "PRINTER_REJECTED") {
          throw error
        }
      } catch (error: Exception) {
        throw classifyError(error)
      } finally {
        connection.disconnect()
      }
    }

    throw lastFailure ?: PrintEngineException(
      code = "PRINTER_REJECTED",
      friendlyMessage = "The printer rejected the test page.",
      retryable = false,
    )
  }

  private fun sendRawJob(request: PrintJobRequest) {
    validateReadableFile(request)

    try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(request.ip, request.port), CONNECT_TIMEOUT_MS)
        socket.soTimeout = READ_TIMEOUT_MS

        BufferedOutputStream(socket.getOutputStream()).use { output ->
          openFileStream(request.fileUri).use { input ->
            input.copyTo(output)
          }
          output.flush()
        }
      }
    } catch (error: Exception) {
      throw classifyError(error)
    }
  }

  private fun sendRawBytes(ip: String, port: Int, bytes: ByteArray) {
    try {
      Socket().use { socket ->
        socket.connect(InetSocketAddress(ip, port), CONNECT_TIMEOUT_MS)
        socket.soTimeout = READ_TIMEOUT_MS

        BufferedOutputStream(socket.getOutputStream()).use { output ->
          output.write(bytes)
          output.flush()
        }
      }
    } catch (error: Exception) {
      throw classifyError(error)
    }
  }

  private fun validateReadableFile(request: PrintJobRequest) {
    if (!SUPPORTED_MIME_TYPES.contains(request.mimeType.lowercase(Locale.US))) {
      throw PrintEngineException(
        code = "UNSUPPORTED_FORMAT",
        friendlyMessage = "PrintForge can print PDF, JPG, and PNG files right now.",
        retryable = false,
      )
    }

    try {
      openFileStream(request.fileUri).use { input ->
        val firstByte = input.read()
        if (firstByte == -1) {
          throw PrintEngineException(
            code = "FILE_CORRUPTED",
            friendlyMessage = "We could not read this file. Choose it again and retry.",
            retryable = false,
          )
        }
      }
    } catch (error: PrintEngineException) {
      throw error
    } catch (error: Exception) {
      throw classifyError(error)
    }
  }

  private fun openFileStream(uri: String): BufferedInputStream {
    val inputStream = try {
      reactContext.contentResolver.openInputStream(Uri.parse(uri))
    } catch (error: Exception) {
      throw classifyError(error)
    } ?: throw PrintEngineException(
      code = "FILE_CORRUPTED",
      friendlyMessage = "We could not open this file. Choose it again and retry.",
      retryable = false,
    )

    return BufferedInputStream(inputStream)
  }

  private fun validateIppResponse(connection: HttpURLConnection) {
    val statusCode = try {
      connection.responseCode
    } catch (error: Exception) {
      throw classifyError(error)
    }

    if (statusCode !in 200..299) {
      throw PrintEngineException(
        code = if (statusCode == HTTP_UNSUPPORTED_MEDIA_TYPE) "UNSUPPORTED_FORMAT" else "PRINTER_REJECTED",
        friendlyMessage = if (statusCode == HTTP_UNSUPPORTED_MEDIA_TYPE) {
          "This printer does not support that file format."
        } else {
          "The printer rejected the print request."
        },
        retryable = statusCode >= 500,
      )
    }

    val response = try {
      connection.inputStream.use { input ->
        val header = ByteArray(IPP_RESPONSE_HEADER_BYTES)
        val readCount = input.read(header)
        if (readCount >= IPP_RESPONSE_HEADER_BYTES) header else null
      }
    } catch (_: Exception) {
      null
    }

    if (response != null) {
      val ippStatus = ((response[2].toInt() and 0xff) shl 8) or (response[3].toInt() and 0xff)
      if (ippStatus !in IPP_SUCCESS_RANGE) {
        throw PrintEngineException(
          code = "PRINTER_REJECTED",
          friendlyMessage = "The printer could not accept this print job.",
          retryable = false,
        )
      }
    }
  }

  private fun createIppPrintJobHeader(
    ip: String,
    port: Int,
    fileName: String,
    mimeType: String,
    path: String,
  ): ByteArray {
    val output = ByteArrayOutputStream()
    output.write(byteArrayOf(0x02, 0x00))
    output.writeShort(IPP_PRINT_JOB_OPERATION)
    output.writeInt((System.currentTimeMillis() and 0x7fffffff).toInt())
    output.write(IPP_OPERATION_ATTRIBUTES_TAG)
    output.writeIppAttribute(IPP_TAG_CHARSET, "attributes-charset", "utf-8")
    output.writeIppAttribute(IPP_TAG_NATURAL_LANGUAGE, "attributes-natural-language", "en")
    output.writeIppAttribute(IPP_TAG_URI, "printer-uri", "ipp://$ip:$port$path")
    output.writeIppAttribute(IPP_TAG_NAME, "requesting-user-name", "PrintForge")
    output.writeIppAttribute(IPP_TAG_NAME, "job-name", fileName)
    output.writeIppAttribute(IPP_TAG_MIME_TYPE, "document-format", mimeType)
    output.write(IPP_END_OF_ATTRIBUTES_TAG)
    return output.toByteArray()
  }

  private fun classifyError(error: Exception): PrintEngineException {
    return when (error) {
      is PrintEngineException -> error
      is SocketTimeoutException -> PrintEngineException(
        code = "TIMEOUT",
        friendlyMessage = "The printer took too long to respond. It may be busy or offline.",
      )
      is ConnectException -> PrintEngineException(
        code = "PRINTER_OFFLINE",
        friendlyMessage = "We could not reach the printer. It may be offline or on another network.",
      )
      is FileNotFoundException,
      is SecurityException -> PrintEngineException(
        code = "FILE_CORRUPTED",
        friendlyMessage = "We could not read this file. Choose it again and retry.",
        retryable = false,
      )
      else -> PrintEngineException(
        code = "PRINT_FAILED",
        friendlyMessage = "We could not send this print. Please try again.",
      )
    }
  }

  private fun PrintEngineException.toResult(
    startedAt: Long,
    request: PrintJobRequest? = null,
  ): PrintEngineResult {
    return PrintEngineResult(
      jobId = request?.let { createJobId(it, startedAt) } ?: "job-$startedAt",
      status = "failed",
      protocolUsed = request?.protocol?.name ?: "UNKNOWN",
      attempts = MAX_ATTEMPTS,
      latencyMs = elapsedSince(startedAt),
      message = friendlyMessage,
      errorCode = code,
    )
  }

  private fun PrintEngineResult.toWritableMap(): WritableMap {
    return Arguments.createMap().apply {
      putString("jobId", jobId)
      putString("status", status)
      putString("protocolUsed", protocolUsed)
      putInt("attempts", attempts)
      putInt("latencyMs", latencyMs.toInt())
      putString("message", message)
      if (errorCode == null) {
        putNull("errorCode")
      } else {
        putString("errorCode", errorCode)
      }
    }
  }

  private fun ByteArrayOutputStream.writeIppAttribute(tag: Int, name: String, value: String) {
    val nameBytes = name.toByteArray(Charsets.UTF_8)
    val valueBytes = value.toByteArray(Charsets.UTF_8)
    write(tag)
    writeShort(nameBytes.size)
    write(nameBytes)
    writeShort(valueBytes.size)
    write(valueBytes)
  }

  private fun ByteArrayOutputStream.writeShort(value: Int) {
    write((value shr 8) and 0xff)
    write(value and 0xff)
  }

  private fun ByteArrayOutputStream.writeInt(value: Int) {
    write((value shr 24) and 0xff)
    write((value shr 16) and 0xff)
    write((value shr 8) and 0xff)
    write(value and 0xff)
  }

  private fun createJobId(request: PrintJobRequest, startedAt: Long): String {
    return createJobId(request.ip, request.port, request.fileName, startedAt)
  }

  private fun createJobId(ip: String, port: Int, fileName: String, startedAt: Long): String {
    val input = "$ip:$port:$fileName:$startedAt"
    val digest = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
    return "job-${digest.take(8).joinToString("") { "%02x".format(it) }}"
  }

  private fun createTestPrintPayload(request: TestPrintJobRequest): TestPrintPayload {
    if (request.protocol == PrintProtocol.IPP) {
      return TestPrintPayload(
        bytes = createPdfTestPrintPayload(request),
        mimeType = "application/pdf",
      )
    }

    return TestPrintPayload(
      bytes = createTextTestPrintPayload(request),
      mimeType = "text/plain",
    )
  }

  private fun createTextTestPrintPayload(request: TestPrintJobRequest): ByteArray {
    val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", Locale.US).format(Date())
    return """
      PrintForge Test Page
      Connect. Print. Scan. Simplified.

      Printer
      Name: ${request.printerName}
      IP address: ${request.ip}
      Port: ${request.port}
      Protocol: ${request.protocol.name}
      Time: $timestamp
      Diagnostic code: ${request.diagnosticCode}

      Your phone reached this printer successfully.
      If this page printed clearly, basic printing is working.

      Color check
      BLACK   [########################]
      CYAN    [########################]
      MAGENTA [########################]
      YELLOW  [########################]
      BLUE    [########################]
      GREEN   [########################]
      RED     [########################]

      Alignment grid
      +----+----+----+----+----+----+----+----+
      | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 |
      +----+----+----+----+----+----+----+----+
      | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 |
      +----+----+----+----+----+----+----+----+
      | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 |
      +----+----+----+----+----+----+----+----+

      If any row is missing, faded, or shifted, run diagnostics in PrintForge.
    """.trimIndent().toByteArray(Charsets.UTF_8)
  }

  private fun createPdfTestPrintPayload(request: TestPrintJobRequest): ByteArray {
    val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss z", Locale.US).format(Date())
    val content = buildString {
      appendText(54, 742, 24, "PrintForge Test Page")
      appendText(54, 716, 11, "Connect. Print. Scan. Simplified.")
      appendText(54, 680, 12, "Printer: ${request.printerName}")
      appendText(54, 662, 11, "IP: ${request.ip}:${request.port}    Protocol: ${request.protocol.name}")
      appendText(54, 644, 11, "Time: $timestamp")
      appendText(54, 626, 11, "Diagnostic code: ${request.diagnosticCode}")
      appendText(54, 590, 14, "Color check")
      appendColorBar(54, 560, 0.0, 0.0, 0.0, "BLACK")
      appendColorBar(128, 560, 0.0, 0.68, 0.86, "CYAN")
      appendColorBar(202, 560, 0.86, 0.0, 0.58, "MAGENTA")
      appendColorBar(276, 560, 1.0, 0.82, 0.1, "YELLOW")
      appendColorBar(350, 560, 0.1, 0.38, 0.92, "BLUE")
      appendColorBar(424, 560, 0.2, 0.72, 0.36, "GREEN")
      appendText(54, 518, 14, "Alignment grid")
      appendGrid(54, 336, 504, 150, 8, 5)
      appendText(54, 296, 11, "If bars are missing, faded, or shifted, run diagnostics in PrintForge.")
    }

    return createPdfDocument(content)
  }

  private fun StringBuilder.appendText(x: Int, y: Int, size: Int, text: String) {
    append("BT /F1 $size Tf $x $y Td (${escapePdfText(text)}) Tj ET\n")
  }

  private fun StringBuilder.appendColorBar(
    x: Int,
    y: Int,
    red: Double,
    green: Double,
    blue: Double,
    label: String,
  ) {
    append("$red $green $blue rg $x $y 58 22 re f\n")
    appendText(x, y - 16, 8, label)
  }

  private fun StringBuilder.appendGrid(
    x: Int,
    y: Int,
    width: Int,
    height: Int,
    columns: Int,
    rows: Int,
  ) {
    append("0.12 0.14 0.18 RG 0.75 w\n")
    for (column in 0..columns) {
      val lineX = x + ((width.toDouble() / columns) * column).toInt()
      append("$lineX $y m $lineX ${y + height} l S\n")
    }
    for (row in 0..rows) {
      val lineY = y + ((height.toDouble() / rows) * row).toInt()
      append("$x $lineY m ${x + width} $lineY l S\n")
    }
  }

  private fun createPdfDocument(content: String): ByteArray {
    val contentBytes = content.toByteArray(Charsets.US_ASCII)
    val objects = listOf(
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      "<< /Length ${contentBytes.size} >>\nstream\n$content\nendstream",
    )
    val output = StringBuilder("%PDF-1.4\n")
    val offsets = mutableListOf(0)

    objects.forEachIndexed { index, body ->
      offsets.add(output.toString().toByteArray(Charsets.US_ASCII).size)
      output.append("${index + 1} 0 obj\n$body\nendobj\n")
    }

    val xrefOffset = output.toString().toByteArray(Charsets.US_ASCII).size
    output.append("xref\n0 ${objects.size + 1}\n")
    offsets.forEachIndexed { index, offset ->
      if (index == 0) {
        output.append("0000000000 65535 f \n")
      } else {
        output.append(String.format(Locale.US, "%010d 00000 n \n", offset))
      }
    }
    output.append("trailer\n<< /Size ${objects.size + 1} /Root 1 0 R >>\n")
    output.append("startxref\n$xrefOffset\n%%EOF\n")

    return output.toString().toByteArray(Charsets.US_ASCII)
  }

  private fun escapePdfText(value: String): String {
    return value
      .replace("\\", "\\\\")
      .replace("(", "\\(")
      .replace(")", "\\)")
      .filter { it.code in 32..126 }
  }

  private fun elapsedSince(startedAt: Long): Long {
    return (System.currentTimeMillis() - startedAt).coerceAtLeast(0L)
  }

  private fun logPattern(event: String, detail: String?) {
    Log.d(LOG_TAG, if (detail == null) event else "$event · $detail")
  }

  private enum class PrintProtocol {
    IPP,
    RAW,
  }

  private data class PrintJobRequest(
    val ip: String,
    val port: Int,
    val protocol: PrintProtocol,
    val fileUri: String,
    val fileName: String,
    val mimeType: String,
  ) {
    companion object {
      fun fromReadableMap(request: ReadableMap): PrintJobRequest {
        val ip = request.getString("ip")?.trim().orEmpty()
        val port = request.getDouble("port").toInt()
        val protocol = when (request.getString("protocol")?.uppercase(Locale.US)) {
          "IPP" -> PrintProtocol.IPP
          "RAW" -> PrintProtocol.RAW
          else -> throw PrintEngineException(
            code = "UNSUPPORTED_PROTOCOL",
            friendlyMessage = "This printer connection is not ready for printing yet.",
            retryable = false,
          )
        }
        val fileUri = request.getString("fileUri").orEmpty()
        val fileName = request.getString("fileName")?.takeIf { it.isNotBlank() } ?: "PrintForge document"
        val mimeType = request.getString("mimeType")?.lowercase(Locale.US).orEmpty()

        if (ip.isBlank() || port !in 1..65535 || fileUri.isBlank()) {
          throw PrintEngineException(
            code = "PRINT_INVALID_INPUT",
            friendlyMessage = "We need a printer and a file before printing.",
            retryable = false,
          )
        }

        return PrintJobRequest(ip, port, protocol, fileUri, fileName, mimeType)
      }
    }
  }

  private data class TestPrintJobRequest(
    val ip: String,
    val port: Int,
    val protocol: PrintProtocol,
    val printerName: String,
    val diagnosticCode: String,
  ) {
    companion object {
      fun fromReadableMap(request: ReadableMap): TestPrintJobRequest {
        val ip = request.getString("ip")?.trim().orEmpty()
        val port = request.getDouble("port").toInt()
        val protocol = when (request.getString("protocol")?.uppercase(Locale.US)) {
          "IPP" -> PrintProtocol.IPP
          "RAW" -> PrintProtocol.RAW
          else -> throw PrintEngineException(
            code = "UNSUPPORTED_PROTOCOL",
            friendlyMessage = "This printer connection is not ready for printing yet.",
            retryable = false,
          )
        }
        val printerName = request.getString("printerName")?.takeIf { it.isNotBlank() }
          ?: "PrintForge printer"
        val diagnosticCode = request.getString("diagnosticCode")?.takeIf { it.isNotBlank() }
          ?: "PF-LOCAL"

        if (ip.isBlank() || port !in 1..65535) {
          throw PrintEngineException(
            code = "PRINT_INVALID_INPUT",
            friendlyMessage = "We need a printer before sending a test page.",
            retryable = false,
          )
        }

        return TestPrintJobRequest(ip, port, protocol, printerName, diagnosticCode)
      }
    }
  }

  private data class PrintEngineResult(
    val jobId: String,
    val status: String,
    val protocolUsed: String,
    val attempts: Int,
    val latencyMs: Long,
    val message: String,
    val errorCode: String?,
  )

  private data class TestPrintPayload(
    val bytes: ByteArray,
    val mimeType: String,
  )

  private class PrintEngineException(
    val code: String,
    val friendlyMessage: String,
    val retryable: Boolean = true,
  ) : Exception(friendlyMessage)

  companion object {
    private const val LOG_TAG = "PrintForgePrintEngine"
    private const val CONNECT_TIMEOUT_MS = 8000
    private const val READ_TIMEOUT_MS = 20000
    private const val MAX_ATTEMPTS = 2
    private const val HTTP_UNSUPPORTED_MEDIA_TYPE = 415
    private const val IPP_PRINT_JOB_OPERATION = 0x0002
    private const val IPP_OPERATION_ATTRIBUTES_TAG = 0x01
    private const val IPP_END_OF_ATTRIBUTES_TAG = 0x03
    private const val IPP_TAG_NAME = 0x42
    private const val IPP_TAG_URI = 0x45
    private const val IPP_TAG_CHARSET = 0x47
    private const val IPP_TAG_NATURAL_LANGUAGE = 0x48
    private const val IPP_TAG_MIME_TYPE = 0x49
    private const val IPP_RESPONSE_HEADER_BYTES = 4
    private val IPP_PATHS = listOf("/ipp/print", "/ipp/printer", "/printers/print", "/")
    private val IPP_SUCCESS_RANGE = 0x0000..0x0002
    private val SUPPORTED_MIME_TYPES = setOf("application/pdf", "image/jpeg", "image/png")
  }
}
