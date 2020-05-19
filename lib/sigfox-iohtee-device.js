"use strict";

const util = require('util');
const SigfoxIohteeDriver = require('sigfox-iohtee-driver');
const GatewayAddOn = require("gateway-addon");

class SigfoxIohteeDevice extends GatewayAddOn.Device {

  constructor(adapter, manifest, name) {
    super(adapter, name);
    this.manifest = manifest;
    this.port = manifest.moziot.config.port;
    this['@context'] = 'https://iot.mozilla.org/schemas/';
    this.name = name;
    this.description = manifest.description;
    this.debug = manifest.moziot.config.debug;
    this.device = new SigfoxIohteeDriver(port);
    this.properties.bytes = new SigfoxIohteeProperty(
      this,
      'bytes',
      'One to twelve bytes to send to Sigfox Cloud',
      null
    );
  }

}

class SigfoxIohteeProperty {

  constructor(device, name, description, value) {
    this.device = device
    this.title = name
    this.name = name
    this.description = description
    this.value = value
    this.set_cached_value(value)
  }
  
  set_value(value) {
    console.log(util.format("info: sigfox-iohtee.%s from %s to %s", this.name, this.value, value));
    if (this.name === 'bytes') {
      try {
        const buf = Buffer.from(this.value);
        if (buf.length >= 1 && buf.length <= 12) {
          this.device.controller.sendBytes(Buffer.from(value));
        }
      }
      catch(e) {
        console.error("set_value bytes failed.");
      }
    }
  }

}

exports.SigfoxIohteeDevice = SigfoxIohteeDevice;
