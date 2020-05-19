'use strict';

function maybeLoadSigfoxIohteeAdapter(addonManager, manifest, errorCallback) {
  const loadSigfoxIohteeAdapter = require('./lib/sigfox-iohtee-adapter');

  return loadSigfoxIohteeAdapter(addonManager, manifest, errorCallback);
}

module.exports = maybeLoadSigfoxIohteeAdapter;
