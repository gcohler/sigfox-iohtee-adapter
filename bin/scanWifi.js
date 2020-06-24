'use strict';

const scanner = require('node-wifi-scanner');
const axios = require('axios');
const url = require('url');
const util = require('util');

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

const request = (options) => {
  const requestOptions = {
    method: options.method,
    url: url.parse(options.url),
    timeout: 10000,
    headers: {
      'Content-Type':'application/json',
    },
  };
  if (options.data) {
    requestOptions.data = JSON.stringify(options.data);
  }
  return axios.request(requestOptions)
}

sortedScan().then((wifiAccessPoints) => {
  console.log("SORTED WIFI ACCESS POINTS", JSON.stringify(wifiAccessPoints, null, 2));
  return request({
    url: util.format("%s?key=%s&user=%s", 'https://global.skyhookwireless.com/wps2/json/location',
      process.env.SKYHOOK_WIRELESS_KEY, process.env.SKYHOOK_WIRELESS_USERID),
    method: 'POST',
    data: {
      considerIp: 'false',
      wifiAccessPoints: wifiAccessPoints
    },
  })
}).then((results) => {
  console.log("RESULTS", JSON.stringify(results.data, null, 2));
});
