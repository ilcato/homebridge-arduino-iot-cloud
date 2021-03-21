// MIT License

// Copyright (c) 2021 ilcato

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// Arduino IoT Cloud Platform plugin for HomeBridge
//
// Remember to add platform to config.json. Example:
// "platforms": [
//     {
//			"platform": "ArduinoIoTCloud",
//			"name": "ArduinoIoTCloud",
//			"clientid": "YOUR_ARDUINO_IOT_CLOUD_CLIENTID",
//			"clientsecret": "YOUR_ARDUINO_IOT_CLOUD_CLIENT_SECRET"
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict'

import { Mutex } from 'async-mutex';

import { Config } from './config'
import {
	pluginName,
	platformName,
	ArduinoAccessory
} from './arduino-accessory';

import { arduinoConnectionManager } from './arduino-connection-manager';


let Accessory,
	Service,
	Characteristic,
	UUIDGen;

export = function (homebridge) {
	Accessory = homebridge.platformAccessory;
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	UUIDGen = homebridge.hap.uuid;
	homebridge.registerPlatform(pluginName, platformName, ArduinoIoTCloudPlatform, true)
}

class ArduinoIoTCloudPlatform {
	log: (format: string, message: any) => void;
	config: Config;
	api: any;
	accessories: Map<string, any>;
	arduinoClientMqtt: any;
	arduinoClientHttp: any;
	mutex = new Mutex();

	constructor(log: (format: string, message: any) => void, config: Config, api: any) {
		this.log = log;
		this.api = api;

		this.accessories = new Map();
		this.config = config;

		this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));

	}
	async connect() {
		await this.mutex.runExclusive(async () => {
			if (this.arduinoClientMqtt || this.arduinoClientHttp) {
				return;
			}
			try {
				this.arduinoClientMqtt = await arduinoConnectionManager.getClientMqtt(this.config, this.log);
				this.arduinoClientHttp = await arduinoConnectionManager.getClientHttp(this.config, this.log);
				if (!this.arduinoClientMqtt || !this.arduinoClientHttp) {
					this.log("Error connecting to Arduino IoT Cloud: ", "Cannot obtain mqtt client or http client.");
				}

			} catch (e) {
				this.log("Error connecting to Arduino IoT Cloud: ", e);
			}
		});
	}
	async didFinishLaunching() {
		this.log('didFinishLaunching.', '')

		try {
			await this.connect();
			const things = await this.arduinoClientHttp.getThings();
			things.map(async (t, i, a) => {
				const properties = await this.arduinoClientHttp.getProperties(t.id)
				this.LoadAccessories(t, properties);
			});
			// Remove no more present accessories from cache
			let aa = this.accessories.values() // Iterator for accessories, key is the uniqueseed
			for (let a of aa) {
				if (!a.reviewed) {
					this.removeAccessory(a);
				}
			}
		} catch (err) {
			this.log("Error connecting to Arduino IoT Cloud: ", err);
		}
	}

	async configureAccessory(accessory) {
		await this.connect();
		this.log("Configured Accessory: ", accessory.displayName);
		for (let s = 0; s < accessory.services.length; s++) {
			const service = accessory.services[s];
			if (service.subtype == undefined) continue;
			for (let i = 0; i < service.characteristics.length; i++) {
				const characteristic = service.characteristics[i];
				if (characteristic.UUID == (new Characteristic.Name()).UUID)
					continue;
				this.bindCharacteristicEvents(characteristic, service);
				this.registerAutomaticUpdate(characteristic, service)
			}
		}
		this.accessories.set(accessory.context.uniqueSeed, accessory);
		accessory.reachable = true;
	}

	LoadAccessories(thing, properties) {
		this.log('Loading accessories', '');
		if (!(properties instanceof Array))
			return;
		if (properties === null || properties.length === 0)
			return;
		properties.map((p, i, a) => {
			this.addAccessory(ArduinoAccessory.createArduinoAccessory(thing, p, Accessory, Service, Characteristic, this));
		});
	}

	addAccessory(arduinoAccessory) {
		if (arduinoAccessory === null)
			return;

		let uniqueSeed = arduinoAccessory.name;
		let isNewAccessory = false;
		let a: any = this.accessories.get(uniqueSeed);
		if (a == null) {
			isNewAccessory = true;
			let uuid = UUIDGen.generate(uniqueSeed);
			a = new Accessory(arduinoAccessory.name, uuid); // Create the HAP accessory
			a.context.uniqueSeed = uniqueSeed;
			this.accessories.set(uniqueSeed, a);
		}
		arduinoAccessory.setAccessory(a);
		// init accessory
		arduinoAccessory.initAccessory();
		// Remove services existing in HomeKit, device no more present in Arduino IoT Cloud
		//		arduinoAccessory.removeNoMoreExistingServices();
		// Add services present in Arduino IoT Cloud and not existing in Homekit accessory
		arduinoAccessory.addNewServices(this);
		// Register or update platform accessory
		arduinoAccessory.registerUpdateAccessory(isNewAccessory, this.api);
		this.log("Added/changed accessory: ", arduinoAccessory.name);
	}

	removeAccessory(accessory) {
		this.log('Remove accessory', accessory.displayName);
		this.api.unregisterPlatformAccessories(pluginName, platformName, [accessory]);
		this.accessories.delete(accessory.context.uniqueSeed);
	}

	async registerAutomaticUpdate(characteristic, service) {
		let params = service.subtype.split("|"); // params[0]: device_id, params[1]: thing_id, para[2]: property_id, para[3]: property_variable_name, para[4]: property_type
		//let device_id = params[0];
		let thing_id = params[1];
		//let property_id = params[2];        
		let property_variable_name = params[3];
		let property_type = params[4];

		try {
			await this.arduinoClientMqtt.onPropertyValue(thing_id, property_variable_name, v => {
				let boolValue = v;
				switch (typeof v) {
					case 'string':
						boolValue = (v === "false" || v === "0") ? false : true;
						break;
					case 'number':
						boolValue = v === 0 ? false : true;
						break;
					case 'object':
						boolValue = (v.swi === 0 || v.swi === false) ? false : true;
						break;
				}
				switch (characteristic.UUID) {
					case (new Characteristic.On()).UUID:
						characteristic.updateValue(boolValue);
						break;
					case (new Characteristic.Brightness()).UUID:
						characteristic.updateValue(v.bri);
						break;
					case (new Characteristic.Hue()).UUID:
						characteristic.updateValue(v.hue);
						break;
					case (new Characteristic.Saturation()).UUID:
						characteristic.updateValue(v.sat);
						break;
					case (new Characteristic.ContactSensorState()).UUID:
						characteristic.updateValue(boolValue === false ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
						break;
					case (new Characteristic.CurrentTemperature()).UUID:
						if (property_type === 'HOME_TEMPERATURE_F') {
							v = this.convertFtoC(v);
						} characteristic.updateValue(v);
						break;
					case (new Characteristic.MotionDetected()).UUID:
						characteristic.updateValue(boolValue);
						break;
					default:
						break
				}
				this.log("Updating device: ", `${service.displayName}, characteristic: ${characteristic.displayName}, last value: ${v}`);
			});
		} catch (err) {
			this.log('Error subscribing to property value', err);;
		}
	}

	bindCharacteristicEvents(characteristic, service) {
		characteristic.on('set', (value, callback, context) => {
			callback();
			this.setCharacteristicValue(value, context, characteristic, service);
		});
		characteristic.on('get', (callback) => {
			callback(undefined, characteristic.value);
			this.getCharacteristicValue(characteristic, service);
		});
	}

	async setCharacteristicValue(value, context, characteristic, service) {
		if (context !== 'fromSetValue') {
			let params = service.subtype.split("|"); // params[0]: device_id, params[1]: thing_id, para[2]: property_id, para[3]: property_name, para[4]: property_type
			//let device_id = params[0];
			let thing_id = params[1];
			let property_id = params[2];
			//let property_name = params[3];
			let property_type = params[4];
			this.log("Setting device: ", `${service.displayName}, characteristic: ${characteristic.displayName}, value: ${value}`);
			try {
				switch (property_type) {
					case 'HOME_SWITCH':
					case 'HOME_SMART_PLUG':
					case 'HOME_LIGHT':
						await this.arduinoClientHttp.setProperty(thing_id, property_id, value);
						break;
					case 'HOME_DIMMED_LIGHT':
						await this.arduinoClientHttp.setProperty(thing_id, property_id, this.formatDimmedLightValue(service));
						break;
					case 'HOME_COLORED_LIGHT':
						await this.arduinoClientHttp.setProperty(thing_id, property_id, this.formatColoredLightValue(service));
						break;
					default:
						break
				}
			} catch (error) {
				this.log("Error setting device: ", `${service.displayName}, characteristic: ${characteristic.displayName}, err: ${error}`);
			}
		}
	}


	getCharacteristicValue(characteristic, service) {
		let params = service.subtype.split("|"); // params[0]: device_id, params[1]: thing_id, para[2]: property_id, para[3]: property_name, para[4]: property_type
		//let device_id = params[0];        
		let thing_id = params[1];
		let property_id = params[2];
		//let property_name = params[3];  
		let property_type = params[4];

		this.arduinoClientHttp.getProperty(thing_id, property_id)
			.then(response => {
				let last_value = response.last_value;
				let boolValue = last_value;
				switch (typeof last_value) {
					case 'string':
						boolValue = (last_value === "false" || last_value === "0") ? false : true;
						break;
					case 'number':
						boolValue = last_value === 0 ? false : true;
						break;
					case 'object':
						boolValue = last_value.swi === 0 ? false : true;
						break;
				}
				switch (characteristic.UUID) {
					case (new Characteristic.On()).UUID:
						characteristic.updateValue(boolValue);
						break;
					case (new Characteristic.Brightness()).UUID:
						characteristic.updateValue(last_value.bri);
						break;
					case (new Characteristic.Hue()).UUID:
						characteristic.updateValue(last_value.hue);
						break;
					case (new Characteristic.Saturation()).UUID:
						characteristic.updateValue(last_value.sat);
						break;
					case (new Characteristic.ContactSensorState()).UUID:
						characteristic.updateValue(boolValue === false ? Characteristic.ContactSensorState.CONTACT_DETECTED : Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
						break;
					case (new Characteristic.CurrentTemperature()).UUID:
						if (property_type === 'HOME_TEMPERATURE_F') {
							last_value = this.convertFtoC(last_value);
						}
						characteristic.updateValue(last_value);
						break;
					case (new Characteristic.MotionDetected()).UUID:
						characteristic.updateValue(boolValue);
						break;
					default:
						break
				}
				this.log("Getting device: ", `${service.displayName}, characteristic: ${characteristic.displayName}, last value: ${last_value}`);
			})
			.catch(err => {
				this.log("Getting device: ", `${service.displayName}, characteristic: ${characteristic.displayName}, last value: not connected yet`);
			});
	}
	formatDimmedLightValue(service) {
		return {
			swi: service.characteristics[1].value,
			bri: service.characteristics[2].value,
			hue: 0,
			sat: 0
		};
	}
	formatColoredLightValue(service) {
		return {
			swi: service.characteristics[1].value,
			bri: service.characteristics[2].value,
			hue: service.characteristics[3].value,
			sat: service.characteristics[4].value
		};
	}
	convertFtoC(tempF) {
		return (tempF - 32) * 5 / 9;
	}
}
