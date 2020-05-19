'use strict';

const SigfoxIohteeAdapter = require("./sigfox-iohtee-adapter");

module.exports = (addonManager, manifest) => new SigfoxIohteeAdapter(addonManager, manifest);
