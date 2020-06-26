"use strict";

const {Adapter, Device, Property} = require('gateway-addon');
const SigfoxIohteeDriver = require('sigfox-iohtee-driver');
const fs = require('fs');
const os = require('os');
const path = require('path');
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);
const child_process = require('child_process');
const lockFilename = path.resolve(os.tmpdir(), 'SIGFOX-IOHTEE-LOCK-FILE');

const sortedScan = () => {
  // Note:  This assumes that wpa_cli is installed on the system.  Using node-wifi-scanner only returns the connected
  // access point, not all found on the scan.
  // Also this returns only 2.4GHz APs found in descending signal strength order (i.e. closest first)
  return new Promise((resolve, reject) => {
    const scanResults = child_process.execSync('wpa_cli -i wlan0 scan > /dev/null; sleep 5; wpa_cli -i wlan0 scan_results')
    .toString().split('\n').filter(x => x.length > 0 && !x.match(/^bssid/));  // strip header and blank rows
    resolve(
      scanResults.map(x => {
        const y = x.split('\t');
        return {
          ssid: y[4],
          macAddress: y[0],
          signalStrength: parseInt(y[2]),
          frequency: parseInt(y[1]),
        }
      })
      .filter(x => x.frequency >= 2400 && x.frequency < 2500)
      .sort((a, b) => b.signalStrength - a.signalStrength)
    );
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
    let bytes;
    let controller;
    return Promise.resolve().then(() => {
      if (this.name !== 'bytes' && this.name !== 'sendWifiScan') {
        throw new Error('No such property');
      }
      switch(this.name) {
      case 'bytes':
        try {
          bytes = JSON.parse(value);
        }
        catch(e) {
        }
        return;
      case 'sendWifiScan':
        value = false;
        return sortedScan().then((wifiAccessPoints) => {
          if (!wifiAccessPoints.length) {
            throw new Error('No WiFi access points seen on scan');
          }
          console.log("IOHTEE WiFi scan found 2.4 GHz access points", wifiAccessPoints);
          const macAddresses = wifiAccessPoints.map(x => x.macAddress);
          const macAddressBytes = macAddresses.map(x => x.split(':').map(z => parseInt(z, 16)));
          const firstTwo = macAddressBytes.slice(0, 2);
          bytes = [].concat(...firstTwo);
          return;
        })
      }
    }).then(() => {
      if (!bytes || !Array.isArray(bytes) || bytes.length < 1 || bytes.length > 12 ||
        bytes.some(x => isNaN(parseInt(x)) || parseInt(x) < 0 || parseInt(x) >= 256)) {
        throw new Error('Bytes must be JSON array of 1-12 unsigned bytes (0..255)');
      }
      console.log("IOHTEE PROPERTY %s SENDING %s to Sigfox Cloud", this.name, JSON.stringify(bytes));
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
      console.log("IOHTEE Completed, lock file deleted");
      this.setCachedValueAndNotify(value);
      return value;
    }).catch((e) => {
      console.log("IOHTEE ERROR: %s", e.message);
      if (fs.existsSync(lockFilename)) {
        fs.unlinkSync(lockFilename);
        console.log("IOHTEE Lock file deleted");
      }
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
    if (fs.existsSync(lockFilename)) {
      fs.unlinkSync(lockFilename);        // remove any old lock files when adding the adapter.
      console.log("IOHTEE Removing old lock file.");
    }
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
