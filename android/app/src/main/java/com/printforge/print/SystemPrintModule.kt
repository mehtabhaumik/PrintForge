package com.printforge.print

import android.content.Context
import android.net.Uri
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.print.PrintManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.io.FileOutputStream

class SystemPrintModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "SystemPrint"

  @ReactMethod
  fun printFile(request: ReadableMap, promise: Promise) {
    val startedAt = System.currentTimeMillis()
    val activity = getCurrentActivity()

    if (activity == null) {
      promise.resolve(
        systemPrintResult(
          startedAt = startedAt,
          status = "failed",
          message = "System printing is not ready yet. Open PrintForge and try again.",
          errorCode = "PRINT_FAILED",
        ),
      )
      return
    }

    val fileUri = request.getString("fileUri").orEmpty()
    val fileName = request.getString("fileName")?.takeIf { it.isNotBlank() }
      ?: "PrintForge document"
    val mimeType = request.getString("mimeType").orEmpty()

    if (fileUri.isBlank() || mimeType !in SUPPORTED_MIME_TYPES) {
      promise.resolve(
        systemPrintResult(
          startedAt = startedAt,
          status = "failed",
          message = "PrintForge can send PDF, JPG, and PNG files to the system print dialog.",
          errorCode = "UNSUPPORTED_FORMAT",
        ),
      )
      return
    }

    try {
      val printManager = activity.getSystemService(Context.PRINT_SERVICE) as PrintManager
      val adapter = UriPrintDocumentAdapter(
        context = reactContext,
        fileUri = Uri.parse(fileUri),
        fileName = fileName,
        mimeType = mimeType,
      )
      val options = if (request.hasKey("options") && !request.isNull("options")) {
        request.getMap("options")
      } else {
        null
      }
      printManager.print(
        "PrintForge - $fileName",
        adapter,
        buildPrintAttributes(options),
      )
      Log.d(LOG_TAG, "system_print_dialog_opened · $fileName")
      promise.resolve(
        systemPrintResult(
          startedAt = startedAt,
          status = "completed",
          message = "System print dialog opened. Choose a printer to continue.",
          errorCode = null,
        ),
      )
    } catch (error: Exception) {
      Log.d(LOG_TAG, "system_print_failed · ${error.message}")
      promise.resolve(
        systemPrintResult(
          startedAt = startedAt,
          status = "failed",
          message = "We could not open the system print dialog. Try direct print instead.",
          errorCode = "PRINT_FAILED",
        ),
      )
    }
  }

  private fun systemPrintResult(
    startedAt: Long,
    status: String,
    message: String,
    errorCode: String?,
  ): WritableMap {
    return Arguments.createMap().apply {
      putString("jobId", "system-${startedAt}")
      putString("status", status)
      putString("protocolUsed", "SYSTEM")
      putInt("attempts", 1)
      putInt("latencyMs", (System.currentTimeMillis() - startedAt).coerceAtLeast(0L).toInt())
      putString("message", message)
      if (errorCode == null) {
        putNull("errorCode")
      } else {
        putString("errorCode", errorCode)
      }
    }
  }

  private fun buildPrintAttributes(options: ReadableMap?): PrintAttributes {
    val builder = PrintAttributes.Builder()

    when (options?.getString("colorMode")) {
      "grayscale" -> builder.setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
      "color" -> builder.setColorMode(PrintAttributes.COLOR_MODE_COLOR)
    }

    when (options?.getString("duplex")) {
      "long-edge" -> builder.setDuplexMode(PrintAttributes.DUPLEX_MODE_LONG_EDGE)
      "short-edge" -> builder.setDuplexMode(PrintAttributes.DUPLEX_MODE_SHORT_EDGE)
      "off" -> builder.setDuplexMode(PrintAttributes.DUPLEX_MODE_NONE)
    }

    val mediaSize = when (options?.getString("paperSize")) {
      "A4" -> PrintAttributes.MediaSize.ISO_A4
      "Legal" -> PrintAttributes.MediaSize.NA_LEGAL
      else -> PrintAttributes.MediaSize.NA_LETTER
    }
    builder.setMediaSize(
      if (options?.getString("orientation") == "landscape") {
        mediaSize.asLandscape()
      } else {
        mediaSize.asPortrait()
      },
    )

    return builder.build()
  }

  private class UriPrintDocumentAdapter(
    private val context: ReactApplicationContext,
    private val fileUri: Uri,
    private val fileName: String,
    private val mimeType: String,
  ) : PrintDocumentAdapter() {
    override fun onLayout(
      oldAttributes: PrintAttributes?,
      newAttributes: PrintAttributes?,
      cancellationSignal: CancellationSignal?,
      callback: LayoutResultCallback,
      extras: android.os.Bundle?,
    ) {
      if (cancellationSignal?.isCanceled == true) {
        callback.onLayoutCancelled()
        return
      }

      val contentType = if (mimeType == "application/pdf") {
        PrintDocumentInfo.CONTENT_TYPE_DOCUMENT
      } else {
        PrintDocumentInfo.CONTENT_TYPE_PHOTO
      }
      val info = PrintDocumentInfo.Builder(fileName)
        .setContentType(contentType)
        .build()
      callback.onLayoutFinished(info, true)
    }

    override fun onWrite(
      pages: Array<PageRange>,
      destination: ParcelFileDescriptor,
      cancellationSignal: CancellationSignal,
      callback: WriteResultCallback,
    ) {
      try {
        context.contentResolver.openInputStream(fileUri).use { input ->
          if (input == null) {
            callback.onWriteFailed("We could not read this file.")
            return
          }

          FileOutputStream(destination.fileDescriptor).use { output ->
            val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
            while (true) {
              if (cancellationSignal.isCanceled) {
                callback.onWriteCancelled()
                return
              }
              val read = input.read(buffer)
              if (read == -1) {
                break
              }
              output.write(buffer, 0, read)
            }
          }
        }
        callback.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
      } catch (error: Exception) {
        callback.onWriteFailed("We could not prepare this file for printing.")
      }
    }
  }

  companion object {
    private const val LOG_TAG = "PrintForgeSystemPrint"
    private val SUPPORTED_MIME_TYPES = setOf("application/pdf", "image/jpeg", "image/png")
    private const val DEFAULT_BUFFER_SIZE = 16 * 1024
  }
}
