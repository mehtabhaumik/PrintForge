package com.printforge.share

import android.app.Activity
import android.content.Intent
import android.database.Cursor
import android.net.Uri
import android.provider.OpenableColumns
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap

class ShareIntentModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private var hasConsumedInitialShare = false

  override fun getName(): String = "PrintForgeShare"

  @ReactMethod
  fun getInitialSharedFile(promise: Promise) {
    if (hasConsumedInitialShare) {
      promise.resolve(null)
      return
    }

    val activity = getCurrentActivity()
    val sharedFile = activity?.intent?.let { intent ->
      parseSharedFile(activity, intent)
    }
    hasConsumedInitialShare = sharedFile != null

    promise.resolve(sharedFile)
  }

  private fun parseSharedFile(activity: Activity?, intent: Intent): WritableMap? {
    val uri = when (intent.action) {
      Intent.ACTION_SEND -> intent.getParcelableExtra(Intent.EXTRA_STREAM)
      Intent.ACTION_VIEW -> intent.data
      else -> null
    } as? Uri ?: return null
    val mimeType = intent.type ?: activity?.contentResolver?.getType(uri) ?: return null

    if (mimeType !in SUPPORTED_MIME_TYPES) {
      return null
    }

    persistReadPermissionIfAllowed(activity, intent, uri)

    return Arguments.createMap().apply {
      putString("uri", uri.toString())
      putString("name", displayNameFor(activity, uri) ?: fallbackNameFor(mimeType))
      putString("type", mimeType)
      val size = sizeFor(activity, uri)
      if (size == null) {
        putNull("size")
      } else {
        putDouble("size", size.toDouble())
      }
    }
  }

  private fun persistReadPermissionIfAllowed(
    activity: Activity?,
    intent: Intent,
    uri: Uri,
  ) {
    if (activity == null) {
      return
    }

    val flags = intent.flags and
      (Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION)

    if (flags and Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION == 0) {
      return
    }

    try {
      activity.contentResolver.takePersistableUriPermission(
        uri,
        Intent.FLAG_GRANT_READ_URI_PERMISSION,
      )
    } catch (_: Exception) {
      // Some share providers grant temporary read access only, which is enough
      // for the immediate print flow.
    }
  }

  private fun displayNameFor(activity: Activity?, uri: Uri): String? {
    val cursor: Cursor = activity?.contentResolver?.query(
      uri,
      arrayOf(OpenableColumns.DISPLAY_NAME),
      null,
      null,
      null,
    ) ?: return null

    cursor.use {
      if (it.moveToFirst()) {
        val index = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (index >= 0) {
          return it.getString(index)
        }
      }
    }

    return null
  }

  private fun sizeFor(activity: Activity?, uri: Uri): Long? {
    val cursor: Cursor = activity?.contentResolver?.query(
      uri,
      arrayOf(OpenableColumns.SIZE),
      null,
      null,
      null,
    ) ?: return null

    cursor.use {
      if (it.moveToFirst()) {
        val index = it.getColumnIndex(OpenableColumns.SIZE)
        if (index >= 0 && !it.isNull(index)) {
          return it.getLong(index)
        }
      }
    }

    return null
  }

  private fun fallbackNameFor(mimeType: String) = when (mimeType) {
    "application/pdf" -> "Shared PDF"
    "image/jpeg" -> "Shared photo"
    "image/png" -> "Shared image"
    else -> "Shared file"
  }

  companion object {
    private val SUPPORTED_MIME_TYPES = setOf("application/pdf", "image/jpeg", "image/png")
  }
}
