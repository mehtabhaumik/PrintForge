#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SystemPrint, NSObject)

RCT_EXTERN_METHOD(printFile:(NSDictionary *)request
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
