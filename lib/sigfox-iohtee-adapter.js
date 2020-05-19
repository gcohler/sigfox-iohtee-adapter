"use strict";

const {Adapter, Device, Property} = require('gateway-addon');
const SigfoxIohteeDriver = require('sigfox-iohtee-driver');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

class SigfoxIohteeProperty extends Property {
  constructor(device, name, desc, value) {
    super(device, name, desc);
    this.device = device;
    this.name = name;
    this.value = value;
    this.setCachedValueAndNotify(value);
  }
  setValue(value) {
    return new Promise((resolve, reject) => {
      if (this.name !== 'bytes') {
        reject('No such property');
        return;
      }
      if (!value || typeof value !== 'string' || value.length < 1 || value.length > 12) {
        reject('Improper bytes value: must be string of length 1-12 bytes');
        return;
      }
      console.log("IOHTEE PROPERTY %s SENDING %s to Sigfox Cloud", this.name, JSON.stringify(value));
      let controller = new SigfoxIohteeDriver(this.device.manifest.moziot.config.port);
      console.log("IOHTEE Driver instantiated");
      return controller.waitPortReady().then(() => {
        console.log("IOHTEE Port is ready");
        return controller.checkModuleIsAlive()
      }).then(() => {
        console.log("IOHTEE Controller is alive");
        return controller.sendBytes(Buffer.from(value));
      }).then((bytesSent) => {
        console.log("IOHTEE Sent %s bytes to Sigfox Cloud", bytesSent);
        return controller.close();
      }).then(() => {
        console.log("IOHTEE Closed")
        controller = null;
        return setTimeoutPromise(1000);
      }).then(() => {
        console.log("IOHTEE Completed");
        this.setCachedValueAndNotify(value);
        resolve(value);
      })
    });
  }
}

class SigfoxIohteeDevice extends Device {
  constructor(adapter, id, manifest) {
    super(adapter, id);
    this.manifest = manifest;
    this._id = id;
    this.id = id;
    this.name = id;
    this.adapter = adapter;
    this.description = 'Sigfox Iohtee Device';
    this.properties.set('bytes', new SigfoxIohteeProperty(
      this,
      'bytes',
      {
        title: "Bytes to Send",
        type: 'string',
        readOnly: false
      },
      ''
    ));
  }
}

class SigfoxIohteeAdapter extends Adapter {
  constructor(addonManager, manifest) {
    super(addonManager, manifest.name, manifest.name);
    addonManager.addAdapter(this);
    this.handleDeviceAdded(new SigfoxIohteeDevice(this, 'sigfox-iohtee-device', manifest));
  }
}

const loadSigfoxIohteeAdapter = (addonManager, manifest, errorCallback) => {
  try {
    new SigfoxIohteeAdapter(addonManager, manifest);
  } catch (err) {
    errorCallback(manifest.name, `error: Failed to construct${err}`);
  }
}

module.exports = loadSigfoxIohteeAdapter;
