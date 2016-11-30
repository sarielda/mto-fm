/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Injectable, Inject } from '@angular/core';
import { HttpClient } from './http-client';
import { Request, Response, URLSearchParams } from '@angular/http';
import { Observable } from 'rxjs/Observable';

import { RealtimeDeviceDataProvider } from './realtime-device';
import { APP_CONFIG, AppConfig } from '../app-config';


var CAR_PROBE_URL = '/user/carProbe';
var VEHICLE_URL = '/user/vehicle';

// internal settings
var CAR_STATUS_REFRESH_PERIOD = 0 // was 15000; now, setting 0 not to update via polling (but by WebSock)


@Injectable()
export class RealtimeDeviceDataProviderService {
  private webApiHost: string;
	private appConfig: AppConfig;
  //
	// Devices management
	//
  provider = new RealtimeDeviceDataProvider();

  //
	// Connection to server and reflecting the response to the Map
	//
	activeWsClient = null;
	activeWsSubscribe = null; // WebSocket client
	carStatusIntervalTimer: any;
	wsRetryCount:number = 0;

  constructor(
    private $http: HttpClient,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    this.webApiHost = appConfig.webApiHost;
		this.appConfig = appConfig;
   }

  private getQs(extent: any[], vehicleId: string){
    var xt = extent ? extent: [-180, -90, 180, 90];
    var qlist = ['min_lat='+xt[1], 'min_lng='+xt[0],
                  'max_lat='+xt[3], 'max_lng='+xt[2]];
    if(vehicleId)
        qlist.push('vehicleId=' + vehicleId);
    return qlist.join('&');
  }

  getProbe(vehicleId: string) {
    var qs = this.getQs(null, vehicleId);
    return this.$http.get(CAR_PROBE_URL + '?' + qs).toPromise();
  }

  getVehicle(vehicleId: string){
    return new Promise((resolve, reject) => {
      this.$http.get(VEHICLE_URL + '/' + vehicleId)
      .subscribe((resp: Response) => {
        var vehicle = resp.json();
        resolve(vehicle);
      }, (error: any) => {
        reject(error);
      });
    });
  }

  scheduleVehicleDataLoading(vehicleId: string){
    var device = this.provider.getDevice(vehicleId);
    if(device && !device.vehicle){
      device.vehicle = {};
      this.getVehicle(vehicleId)
      .then(vehicle => { device.vehicle = vehicle; })
      .catch(err => { console.error(err); device.vehicle = undefined; });
    }
  }

  getProvider(){
    return this.provider;
  }

	/**
	 * Start trackgin a region
	 */
	startTracking(extentOrVehicleId, mapHelper?, updateEvents?){
    this.stopTracking(true, mapHelper);

    var qs: string;
    if(typeof extentOrVehicleId === 'string'){
      qs = this.getQs(null, extentOrVehicleId);
    }else{
      var extent = extentOrVehicleId;
      var xt = mapHelper ? mapHelper.expandExtent(extent, 0.1) : extent; // get extended extent to track for map
      qs = this.getQs(xt, null);
    }

		// handle cars
		this.refreshCarStatus(qs).then((data) => {
			// adjust animation time
			if(data.serverTime){
				mapHelper && mapHelper.setTimeFromServerRightNow(data.serverTime);
			}

			// start websock server for real-time tracking
			this.wsRetryCount = 0;
			this.stopWsClient();
			if (data.wssPath){
				var startWssClient = () => {
					var wsProtocol = (location.protocol == "https:") ? "wss" : "ws";
					var wssUrl = wsProtocol + '://' + this.webApiHost + data.wssPath;
					// websock client to keep the device locations latest
					var ws = this.activeWsClient = Observable.webSocket(wssUrl);
					this.activeWsSubscribe = ws.subscribe((data: any) => {
						this.provider.addDeviceSamples(data.devices, true);
						if(this.appConfig.DEBUG){
							console.log('DEBUG-MAP: got devices data from WS: n=' + data.devices.length);
						}
						this.wsRetryCount = 0; // connected
					}, (e) => {
						if (e.type === 'close' || this.wsRetryCount++ < 3){
							this.activeWsSubscribe = null;
							ws.socket.close(); //closeObserver(); observer.dispose();
							// handle close event
							if(ws === this.activeWsClient){ // reconnect only when this ws is active ws
								if (e.type === 'close') {
									console.log('DEBUG-MAP: got wss socket close event. reopening...');
								} else {
									console.log('DEBUG-MAP: got unexpected connection error. reopening... (' + this.wsRetryCount + ')');
								}
								this.activeWsClient = null;
								startWssClient(); // restart!
								return;
							}
						}
						// error
						console.error('DEBUG-MAP: Unrecoverable event from WebSock: ', e);
					});
				};
				startWssClient(); // start wss
			}

			// start animation
			mapHelper && mapHelper.startAnimation();

			// schedule status timer
			var carStatusTimerFunc = () => {
				this.refreshCarStatus(qs);
				this.carStatusIntervalTimer = setTimeout(carStatusTimerFunc, CAR_STATUS_REFRESH_PERIOD);
			}
			if(CAR_STATUS_REFRESH_PERIOD > 0)
					this.carStatusIntervalTimer = setTimeout(carStatusTimerFunc, CAR_STATUS_REFRESH_PERIOD);
		}, (err) => {
			console.warn('it\'s fail to access the server.');
		})

		// handle driver events
		this.refreshDriverEvents(qs, updateEvents);
	};
	// Add/update cars with DB info
	refreshCarStatus(qs) {
		return this.$http.get(CAR_PROBE_URL + '?' + qs).toPromise().then((resp) => {
			let data = resp.json();
			if(data.devices){
				this.provider.addDeviceSamples(data.devices, true);
			}
			return data; // return resp so that subsequent can use the resp
		});
	};
	// Add driver events on the map
	refreshDriverEvents(qs, updateEvents: ((events: any[]) => void)){
		return this.$http.get(CAR_PROBE_URL + '?' + qs).toPromise().then((resp) => {
			let data = resp.json();
			var events = data.devices;
			if (events){
        updateEvents && updateEvents(events);
      }
		});
	};

	/**
	 * Stop server connection
	 */
	stopTracking(intermediate, mapHelper){
		// stop timer
		if(this.carStatusIntervalTimer){
			clearTimeout(this.carStatusIntervalTimer);
			this.carStatusIntervalTimer = 0;
		}
		if(!intermediate){
			// stop animation
			mapHelper && mapHelper.stopAnimation();
			// stop WebSock client
			this.stopWsClient();
		}
	};
	stopWsClient(){
		if (this.activeWsSubscribe){
			this.activeWsSubscribe.unsubscribe();
			this.activeWsSubscribe = null;
		}
		if (this.activeWsClient){
			if (this.activeWsClient.socket && this.activeWsClient.socket){
				this.activeWsClient.socket.close();
			}
			this.activeWsClient = null;
		}
	}


}
