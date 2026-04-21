#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(PrintForgeShare, NSObject)

RCT_EXTERN_METHOD(getInitialSharedFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
