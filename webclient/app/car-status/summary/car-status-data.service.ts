/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs/Observable';

import { RealtimeDeviceData, RealtimeDeviceDataProvider } from '../../shared/realtime-device';
import { RealtimeDeviceDataProviderService } from '../../shared/realtime-device-manager.service';

import * as _ from 'underscore';

export interface StatusGroup {
  label: string,
  predicate: (RealtimeDeviceData) => boolean,
}

var fuelStatusGroups = [
  {label: 'Low', predicate: (device => (device.latestSample.info.alerts.fuelStatus === 'critical'))},
  {label: 'Less than half', predicate: (device => (device.latestSample.info.alerts.fuelStatus === 'troubled'))},
  {label: 'No issue', predicate: (device => true)}
];

var engineTempStatusGroups = [
  {label: 'Over heated', predicate: (device => (device.latestSample.info.alerts.engineTempStatus === 'critical'))},
  {label: 'High', predicate: (device => (device.latestSample.info.alerts.engineTempStatus === 'troubled'))},
  {label: 'No issue', predicate: (device => true)}
];

@Injectable()
export class CarStatusDataService {
  realtimeDeviceDataProvider: RealtimeDeviceDataProvider;

  constructor(private realtimeDataProviderService: RealtimeDeviceDataProviderService ) {
    this.realtimeDeviceDataProvider = this.realtimeDataProviderService.getProvider();
  }

  getProbe(mo_id: string, interval = 1): Observable<any> {
    return Observable.interval(interval * 1000).startWith(0)
      .map(x => {
        this.realtimeDataProviderService.scheduleVehicleDataLoading(mo_id);
        var device = this.realtimeDeviceDataProvider.getDevice(mo_id);
        return device && device.latestSample;
      })
  }

  private getDevicesByConds(conds: StatusGroup[], interval = 1): Observable<any> {
    return Observable.interval(interval * 1000).startWith(0)
      .map(x => {
        let devices = this.realtimeDeviceDataProvider.getDevices();
        let devicesByLabel  = _.groupBy(this.realtimeDeviceDataProvider.getDevices(), device => {
              this.realtimeDataProviderService.scheduleVehicleDataLoading(device.deviceID);
              for(var i=0; i<conds.length; i++){
                if (!conds[i].predicate || conds[i].predicate(device)){
                    return conds[i].label;
                }
              }
              return undefined;
            });
        return devicesByLabel;
      });
  }

  private getCondsFromType(type: string){
    if(type === 'fuel'){
      return fuelStatusGroups;
    }else if (type === 'engineTemp'){
      return engineTempStatusGroups;
    }
    return null;
  }

  getColumns(type: string, interval = 1): Observable<any[][]>{
    let conds = this.getCondsFromType(type);
    return this.getDevicesByConds(conds, interval)
    .map(devicesByLabel => {
      var result = [];
      for (var i=0; i<conds.length; i++){
        let label = conds[i].label;
        let devices = devicesByLabel[label];
        result.push([label, (devices ? devices.length : 0) + 0]);
      }
      return result;
    });
  }

  getDevices(type: string, selection: string, interval = 1): Observable<RealtimeDeviceData[]> {
    let conds = this.getCondsFromType(type);
    return this.getDevicesByConds(conds, interval)
      .map(devicesByLabel => {
        let r = devicesByLabel[selection];
        console.log('CarStatusDataService is returning ', r);
        return r ? r : [];
      });
  }
}
