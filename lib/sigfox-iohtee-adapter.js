"use strict";

const {Adapter, Device, Property} = require('gateway-addon');
const SigfoxIohteeDriver = require('sigfox-iohtee-driver');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
      let bytes;
      try {
        bytes = JSON.parse(value);
      }
      catch(e) {
      }
      if (!bytes || !Array.isArray(bytes) || bytes.length < 1 || bytes.length > 12 ||
        bytes.some(x => isNaN(parseInt(x)) || parseInt(x) < 0 || parseInt(x) >= 256)) {
        reject('Bytes must be JSON array of 1-12 unsigned bytes (0..255)');
        return;
      }
      const fn = path.resolve(os.tmpdir(), 'SIGFOX-IOHTEE-LOCK-FILE');
      let controller;
      console.log("IOHTEE Creating lock file %s", fn);
      return fs.promises.writeFile(fn, '', {flag: 'wx'})
      .then(() => {
        console.log("IOHTEE PROPERTY %s SENDING %s to Sigfox Cloud", this.name, JSON.stringify(bytes));
        controller = new SigfoxIohteeDriver(this.device.manifest.moziot.config.port);
        console.log("IOHTEE Driver instantiated");
        return controller.waitPortReady();
      }).then(() => {
        console.log("IOHTEE Port is ready");
        return controller.checkModuleIsAlive()
      }).then(() => {
        console.log("IOHTEE Controller is alive");
        return controller.sendBytes(Buffer.from(bytes));
      }).then((bytesSent) => {
        console.log("IOHTEE Sent %s bytes to Sigfox Cloud", bytesSent);
        return controller.close();
      }).then(() => {
        console.log("IOHTEE Closed")
        controller = null;
        return setTimeoutPromise(1000);
      }).then(() => {
        return fs.promises.unlink(fn);
      }).then(() => {
        console.log("IOHTEE Completed, lock file released");
        this.setCachedValueAndNotify(value);
        resolve(value);
      });
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
    this['@context'] = 'https://iot.mozilla.org/schemas';
    this['@type'] = [];
    this.links = [
      {
        rel: 'alternate',
        mediaType: 'text/html',
        href: adapter.URL
      }
    ];
    this.properties.set('bytes', new SigfoxIohteeProperty(
      this,
      'bytes',
      {
        title: "Bytes Array",
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
    this.URL = 'https://github.com/gcohler/sigfox-iohtee-adapter'
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
