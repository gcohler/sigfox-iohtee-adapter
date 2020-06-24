"use strict";

const {Adapter, Device, Property} = require('gateway-addon');
const SigfoxIohteeDriver = require('sigfox-iohtee-driver');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);
const scanner = require('node-wifi-scanner');

const sortedScan = () => {
  return new Promise((resolve, reject) => {
    scanner.scan((err, output) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(output.map(x => Object.assign({}, {
        ssid: x.ssid,
        macAddress: x.mac,
        signalStrength: x.rssi,
        channel: x.channel
      })).sort((a, b) => b.signalStrength - a.signalStrength));
    });
  });  
};

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
      if (this.name !== 'bytes' && this.name !== 'sendWifiScan') {
        reject('No such property');
        return;
      }
      let bytes;
      let controller;
      let lockFilename;
      return Promise.resolve().then(() => {
        switch(this.name) {
        case 'bytes':
          try {
            bytes = JSON.parse(value);
          }
          catch(e) {
          }
          break;
        case 'sendWifiScan':
          value = false;
          return sortedScan().then((wifiAccessPoints) => {
            if (!wifiAccessPoints.length) {
              reject('No WiFi access points seen on scan');
            }
            console.log("IOHTEE Sees WiFi access points", wifiAccessPoints);
            const macAddresses = wifiAccessPoints.slice(0, 2).map(x => x.macAddress);
            const macAddressBytes = macAddresses.map(x => x.split(':').map(y => parseInt(y, 16)));
            bytes = [].concat(...macAddressBytes);
            return;
          })
          break;
        }
      }).then(() => {
        if (!bytes || !Array.isArray(bytes) || bytes.length < 1 || bytes.length > 12 ||
          bytes.some(x => isNaN(parseInt(x)) || parseInt(x) < 0 || parseInt(x) >= 256)) {
          reject('Bytes must be JSON array of 1-12 unsigned bytes (0..255)');
          return;
        }
        console.log("IOHTEE PROPERTY %s SENDING %s to Sigfox Cloud", this.name, JSON.stringify(bytes));
        lockFilename = path.resolve(os.tmpdir(), 'SIGFOX-IOHTEE-LOCK-FILE');
        console.log("IOHTEE Creating lock file %s", lockFilename);
        return fs.promises.writeFile(lockFilename, '', {flag: 'wx'})
      }).then(() => {
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
        return fs.promises.unlink(lockFilename);
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
    this.properties.set('sendWifiScan', new SigfoxIohteeProperty(
      this,
      'sendWifiScan',
      {
        '@type': 'BooleanProperty',
        title: 'Send Wifi Scan',
        type: 'boolean',
        readOnly: false
      },
      false
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
