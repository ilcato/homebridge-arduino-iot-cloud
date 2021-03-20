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

const superagent = require('superagent');
const ArduinoClientHttp = require('./arduino-iot-cloud-api-wrapper');
const ArduinoClientMqtt = require('arduino-iot-js');
const accessTokenUri = process.env.ACCESS_TOKEN_URI || 'https://api2.arduino.cc/iot/v1/clients/token';
const accessTokenAudience = process.env.ACCESS_TOKEN_AUDIENCE || 'https://api2.arduino.cc/iot';
//const arduinoIotCloudHost = process.env.MQTT_HOST || 'wss.iot.arduino.cc';

class ArduinoConnectionManager {
  clientMqtt: any;
  clientHttp: any;

  constructor() {
    this.clientMqtt = null;
    this.clientHttp = null;
  }

  async getToken(config) {
    const dataToSend = {
      grant_type: 'client_credentials',
      client_id: config.clientid,
      client_secret: config.clientsecret,
      audience: accessTokenAudience
    };

    try {

      var res = await superagent
        .post(accessTokenUri)
        .set('content-type', 'application/x-www-form-urlencoded')
        .set('accept', 'json')
        .send(dataToSend);
      var token = res.body.access_token;
      var expires_in = res.body.expires_in * 0.8; // needed to change the token before it expires
      if (token !== undefined) {
        return { token: token, expires_in: expires_in };
      }
    } catch (err) {
      if (err.response && err.response.res && err.response.request) {
        console.log('statusCode: ' + err.response.res.statusCode + '\r' +
          'statusMessage: ' + err.response.res.statusMessage + '\r' +
          'text: ' + err.response.res.text + '\r' +
          'HTTP method: ' + err.response.request.method + '\r' +
          'URL request: ' + err.response.request.url
        );
      } else {
        console.log(err);
      }

    }
  }

  async getClientMqtt(config, log) {
    if (!config) {
      throw new Error("Cannot find cooonection config.");
    }
    try {
      this.clientMqtt = ArduinoClientMqtt.ArduinoIoTCloud;
      const options = {
        clientId: config.clientid,
        clientSecret: config.clientsecret,
        onDisconnect: async message => {
          log(`Connection lost for ${config.clientid} - ${message}`);
          await this.reconnectMqtt();
        }
      }
      await this.clientMqtt.connect(options);
      log("Connected to Arduino IoT Cloud MQTT broker.");
      return this.clientMqtt;
    } catch (err) {
      log("Error connecting to MQTT: ", err);
    }

  }

  async getClientHttp(config, log) {
    if (this.clientHttp != null)
      return this.clientHttp;

    if (!config) {
      throw new Error("Cannot find config.");
    }
    try {
      const tokenInfo = await this.getToken(config);
      if (tokenInfo !== undefined) {
        this.clientHttp = new ArduinoClientHttp.ArduinoClientHttp(tokenInfo.token);
        setTimeout(() => { this.updateToken(config, log) }, tokenInfo.expires_in * 1000);
      }
      return this.clientHttp;
    } catch (err) {
      throw err;
    }
  }

  async updateToken(config, log) {
    try {
      const tokenInfo = await this.getToken(config);
      if (tokenInfo !== undefined) {
        this.clientHttp.updateToken(tokenInfo.token);
        setTimeout(() => { this.updateToken(config, log) }, tokenInfo.expires_in * 1000);
      }
    } catch (err) {
      log('Error updating token:', err);
    }
  }

  async reconnectMqtt() {
    await this.clientMqtt.reconnect();
  }
}

export const arduinoConnectionManager = new ArduinoConnectionManager();


