# homebridge-arduino-iot-cloud
Homebridge plugin for Arduino IoT Cloud

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-arduino-iot-cloud) and should be installed "globally" by typing:

    npm install -g homebridge-arduino-iot-cloud

# Configuration
Configure the plugin in config.json in your home directory inside the .homebridge directory, or where your .homebridge directory is; or use homebridge UI. Configuration parameters:
+ "clientid": "YOUR_ARDUINO_IOT_CLOUD_CLIENTID",
+ "clientsecret": "YOUR_ARDUINO_IOT_CLOUD_CLIENT_SECRET"

Look for a sample config in [config.json example](https://github.com/ilcato/homebridge-arduino-iot-cloud/blob/master/config.json)


# Release notes
Version 0.0.4
+ Added support for LIGHT, DIMMED_LIGHT, COLORED_LIGHT, CONTACT_SENSOR, MOTION_SENSOR, SMART_PLUG, TEMPERATURE property types

Version 0.0.3
+ Fix dependencies

Version 0.0.2
+ Added config schema for homebridge UI

Version 0.0.1
+ Basic functionality
+ Only HOME_SWITCH property type supported
