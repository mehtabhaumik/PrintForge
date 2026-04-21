package com.printforge

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.printforge.capability.PrinterCapabilityPackage
import com.printforge.discovery.PrinterDiscoveryPackage
import com.printforge.print.PrintEnginePackage
import com.printforge.share.ShareIntentPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(PrinterCapabilityPackage())
          add(PrinterDiscoveryPackage())
          add(PrintEnginePackage())
          add(ShareIntentPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
