"use strict";

const GatewayAddOn = require("gateway-addon");
const SigfoxIohteeDevice = require("./sigfox-iohtee-device");

class SigfoxIohteeAdapter extends GatewayAddOn.Adapter {
  
  constructor(addonManager, manifest) {
    super(addonManager, SigfoxIohteeAdapter.name, manifest.name);
    addonManager.addAdapter(this);

    const sigfoxIohteeDevice = new SigfoxIohteeDevice(this, manifest, 'Sigfox Iohtee Device');
    this.handleDeviceAdded(sigfoxIohteeDevice);
  }

}

exports.SigfoxIohteeAdapter = SigfoxIohteeAdapter;
