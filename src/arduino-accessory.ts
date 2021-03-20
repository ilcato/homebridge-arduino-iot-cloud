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

'use strict'

export const pluginName = 'homebridge-arduino-iot-cloud';
export const platformName = 'ArduinoIoTCloud';

export class ArduinoService {
	controlService: any;
	characteristics: any[];

	constructor(controlService, characteristics: any[]) {
		this.controlService = controlService;
		this.characteristics = characteristics;
	}
}

export class ArduinoAccessory {

	name: string;
	services: ArduinoService[];
	accessory: any;
	hapAccessory: any;
	hapService: any;
	hapCharacteristic: any;
	platform: any;

	constructor(property: any, services: ArduinoService[], hapAccessory: any, hapService: any, hapCharacteristic: any, platform) {
		this.name = property.name;
		this.services = services;
		this.accessory = null,
			this.hapAccessory = hapAccessory;
		this.hapService = hapService;
		this.hapCharacteristic = hapCharacteristic;
		this.platform = platform;
	}

	initAccessory() {
		this.accessory.getService(this.hapService.AccessoryInformation)
			.setCharacteristic(this.hapCharacteristic.Manufacturer, "IlCato")
			.setCharacteristic(this.hapCharacteristic.Model, "HomeCenterBridgedAccessory")
			.setCharacteristic(this.hapCharacteristic.SerialNumber, "<unknown>");
	}

	removeNoMoreExistingServices() {
		for (let t = 0; t < this.accessory.services.length; t++) {
			let found = false;
			for (let s = 0; s < this.services.length; s++) {
				// TODO: check why test for undefined
				if (this.accessory.services[t].displayName == undefined || this.services[s].controlService.displayName == this.accessory.services[t].displayName) {
					found = true;
					break;
				}
			}
			if (!found) {
				this.accessory.removeService(this.accessory.services[t]);
			}
		}
	}

	addNewServices(platform) {
		for (let s = 0; s < this.services.length; s++) {
			let service = this.services[s];
			let serviceExists = this.accessory.getService(service.controlService.displayName);
			if (!serviceExists) {
				this.accessory.addService(service.controlService);
				for (let i = 0; i < service.characteristics.length; i++) {
					let characteristic = service.controlService.getCharacteristic(service.characteristics[i]);
					characteristic.props.needsBinding = true;
					if (characteristic.UUID == (new this.hapCharacteristic.CurrentAmbientLightLevel()).UUID) {
						characteristic.props.maxValue = 10000;
						characteristic.props.minStep = 1;
						characteristic.props.minValue = 0;
					}
					if (characteristic.UUID == (new this.hapCharacteristic.CurrentTemperature()).UUID) {
						characteristic.props.minValue = -50;
					}
					platform.bindCharacteristicEvents(characteristic, service.controlService);
					platform.registerAutomaticUpdate(characteristic, service.controlService)
				}
			}
		}
	}

	registerUpdateAccessory(isNewAccessory, api) {
		if (isNewAccessory)
			api.registerPlatformAccessories(pluginName, platformName, [this.accessory]);
		else
			api.updatePlatformAccessories([this.accessory]);
		this.accessory.reviewed = true; // Mark accessory as reviewed in order to remove the not reviewed ones
	}

	setAccessory(accessory) {
		this.accessory = accessory;
	}

	static createArduinoAccessory(thing, property, hapAccessory, hapService, hapCharacteristic, platform) {
		let controlService, controlCharacteristics;

		platform.log('type: ', property.type);
		switch (property.type) {
			case 'HOME_SWITCH':
				controlService = new hapService.Switch(property.name);

				controlCharacteristics = [hapCharacteristic.On];
				break;
			default:
				return null;
		}
		controlService.subtype = thing.device_id + "|" + property.thing_id + "|" + property.id + "|" + property.variable_name + "|" + property.type;
		let bs = [new ArduinoService(controlService, controlCharacteristics)];
		return new ArduinoAccessory(property, bs, hapAccessory, hapService, hapCharacteristic, platform);
	}
}
