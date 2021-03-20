# homebridge-arduino-iot-cloud
Homebridge plugin for Arduino IoT Cloud

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-arduino-iot-cloud) and should be installed "globally" by typing:

    npm install -g homebridge-arduino-iot-cloud

# Configuration
Configure the plugin in config.json in your home directory inside the .homebridge directory, or where your .homebridge directory is. Configuration parameters:
+ "clientid": "YOUR_ARDUINO_IOT_CLOUD_CLIENTID",
+ "clientsecret": "YOUR_ARDUINO_IOT_CLOUD_CLIENT_SECRET"

Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-arduino-iot-cloud/blob/master/config.json)


# Release notes
Version 0.0.1
+ Basic functionality
+ Only HOME_SWITCH property type supported
