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

import { Counts } from './counts';
import { RealtimeDeviceData, RealtimeDeviceDataProvider } from '../../shared/realtime-device';
import { RealtimeDeviceDataProviderService } from '../../shared/realtime-device-manager.service';

import * as _ from 'underscore';

@Injectable()
export class NumberOfCarsService {
  // user animatedDeviceManager as the data source
  private animatedDeviceManager: RealtimeDeviceDataProvider;

  constructor(animatedDeviceManagerService: RealtimeDeviceDataProviderService) {
    this.animatedDeviceManager = animatedDeviceManagerService.getProvider();
  }

  getNumberOfCars(region: any, interval = 3): Observable<Counts>{
    var debugKey = Math.floor(Math.random()*100);
    return Observable.interval(interval * 1000)
      .map(x => {
        let devices = this.animatedDeviceManager.getDevices();
        var all = devices.length;
        var troubled = devices.filter(device => (device.latestSample && device.latestSample.status === 'troubled')).length;
        var critical = devices.filter(device => (device.latestSample && device.latestSample.status === 'critical')).length;
        return <Counts>{ _region: region, all: all, troubled: troubled, critical: critical };
      })
      .startWith(loadingData)
      .do(counts => this.log('getNumberOfCars(%s) item: %s', debugKey, counts.all));
  }

  private log(...vargs){
    // console.log.call(vargs);
  }
}

const loadingData: Counts = {
  _region: undefined,
  all: -1,
  troubled: -1,
  critical: -1,
};

const sampleData: Counts = {
  _region: undefined,
  all: 25,
  troubled: 10,
  critical: 2,
};
