# Sigfox Iohtee Adapter

## About

Uses Sigfox Iohtee USB dongle to send 1-12 byte messages to the Sigfox Cloud.

In Mozilla-IoT Gateway terms, the sigfox-iohtee-adapter adapter is a gateway addon.  The adapter creates a single sigfox-iohtee-device device, with two properties, bytes and sendWifiScan.  The two properties are read/write, but are in practice writeable properties that when written will send a message to the Sigfox cloud using the sigfox-iohtee-driver (https://github.com/gcohler/sigfox-iohtee-driver.git) communicating via USB serial port to the Sigfox Iohtee USB dongle.

## Usage

### Pre-requisites

- Requires a Sigfox Iohtee USB dongle plugged into the USB on the Mozilla-IoT Gateway.
- Requires the sigfox-iohtee-adapter repository to be cloned and installed onto the gateway.
- Assumes that you have a Sigfox Cloud account with access to the messages sent by the Sigfox Iohtee USB dongle.
- Assumes that you have already setup a Mozilla-IoT Webthings Gateway on a Raspberry Pi.

### Install

#### Enable SSH access to the Webthings Gateway

Following instructions at <https://iot.mozilla.org/docs/gateway-user-guide.html> enable SSH access to the gateway, and be sure to immediately change the password as shown.

#### Install the sigfox-iohtee-adapter software

Note:  Hopefully in the future, this software will be added to the public library -- such that it can be added without having to clone.  But for now, this is the way that it works.

Using SSH, connect to the gateway and install the sigfox-iohtee-adapter software:

```
ssh pi@gateway.local
```

Then on the gateway:

```
cd /home/pi/.mozilla-iot/addons
git clone https://github.com/gcohler/sigfox-iohtee-adapter.git
cd sigfox-iohtee-adapter
npm install
sudo systemctl restart mozilla-iot-gateway.service
```

#### Monitor the Webthings Gateway activity

Tail the log on the gateway so that you can observe things happening there.

```
sudo journalctl -fu mozilla-iot-gateway.service
```

#### Enable and configure the adapter

Using the browser interface to the Mozilla-IoT gateway:

From the _hamburger_ menu icon, select Settings then Add-ons:

- Select Configure on the Sigfox Iohtee Adapter device
- Enter the Sigfox Iohtee USB Dongle's serial port address (default /dev/ttyUSB0)
- Enable the adapter

#### Test the adapter

Go to the _hamburger_ => Things page and see that the adapter has been loaded and is present in the list.

- Click on the sigfox-iohtee-adapter settings icon should show the two properties (bytes and sendWifiScan)
- Entering a JSON-encoded array of one to twelve unsigned bytes should (after a few seconds) succeed in sending that message to the Sigfox cloud

Example:  Sending [1, 2, 3] should result in the following log entries:

```
INFO   : sigfox-iohtee-adapter: IOHTEE PROPERTY bytes SENDING [1,2,3] to Sigfox Cloud
INFO   : sigfox-iohtee-adapter: IOHTEE Creating lock file /tmp/SIGFOX-IOHTEE-LOCK-FILE
INFO   : sigfox-iohtee-adapter: IOHTEE Driver instantiated
INFO   : sigfox-iohtee-adapter: IOHTEE Port is ready
INFO   : sigfox-iohtee-adapter: IOHTEE Controller is alive
INFO   : sigfox-iohtee-adapter: IOHTEE Sent 3 bytes to Sigfox Cloud
INFO   : sigfox-iohtee-adapter: IOHTEE Closed
INFO   : sigfox-iohtee-adapter: IOHTEE Completed, lock file released
INFO   : sigfox-iohtee-adapter: setCachedValueAndNotify for property bytes from  to [1, 2, 3] for sigfox-iohtee-device
```

## Properties

### bytes

A string property that accepts a JSON-encoded array of one to twelve unsigned bytes as input (e.g. '[1, 2, 3, 4, 5]').  When received, it sends those one to twelve bytes to the sigfox-iohtee-driver sendBytes() function which will in turn send those twelve bytes through the Sigfox Iohtee USB dongle to the Sigfox cloud.

### sendWifiScan

A boolean property that when set (to either true or false) will run a WiFi scan looking for 2.4GHz WiFi Access points, and then send the two closest (highest signalStrength) AP MAC addresses (six bytes each) to the sigfox-iohtee driver sendBytes() function, which in turn will send those via the USB dongle to the Sigfox cloud.

## References

- <https://github.com/gcohler/sigfox-iohtee-driver>
- <https://github.com/mozilla-iot/addon-list>
- <https://github.com/mozilla-iot/wiki/wiki>
- <https://github.com/mozilla-iot/gateway-addon-node>
- <https://iot.mozilla.org/schemas/>
- <https://github.com/mozilla-iot/webthing-node/>
- <https://iot.mozilla.org/docs/gateway-user-guide.html>
