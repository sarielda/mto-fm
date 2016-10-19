/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import * as _ from 'underscore';

/* --------------------------------------------------------------
 * AnimatedDeviceManager
 *
 * This class manages devices and update the device data with device
 * samples sent from the server.
 */
export class RealtimeDeviceDataProvider {
  devices = <{ [key: string]: RealtimeDeviceData }>{};

  getDevice(id){
    return this.devices[id];
  }
  getDevices(){
    return Object.keys(this.devices).map(id => this.devices[id]);
  }
  addDeviceSamples(newDeviceSamples, syncAllDevices = false){
      newDeviceSamples.forEach(sample => {
          if (!sample)
              return;
          // fixup samples
          if(!sample.t) sample.t = sample.ts;
          if(!sample.deviceID) sample.deviceID = sample.mo_id;
          if(!sample.lat) sample.lat = sample.latitude || sample.matched_latitude;
          if(!sample.lng) sample.lng = sample.longitude || sample.matched_longitude;

          // fixup alerts
          if(sample.info && sample.info.alerts && !sample.status){
            // translate alerts to troubled, critical, normal
            let a = sample.info.alerts;
            if(a.Critical || a.High){
              sample.status = 'critical';
            } else if (a.Medium || a.Low) {
              sample.status = 'troubled';
            } else {
              sample.status = 'normal';
            }
          }

          // polyfill status
          if(sample.info && sample.info.alerts && sample.info.alerts.byType){
            var byType = sample.info.alerts.byType;
            if(!sample.info.alerts.fuelStatus){
              sample.info.alerts.fuelStatus = byType.low_fuel ? 'critical' : (byType.half_fuel ? 'troubled' : 'normal');
            }
            if(!sample.info.alerts.engineTempStatus){
              sample.info.alerts.engineTempStatus = byType.high_engine_temp ? 'critical' : 'normal';
            }
          }

          // update the device latest location
          var device = this.devices[sample.deviceID];
          if (device) {
              device.addSample(sample);
          }
          else {
              device = this.devices[sample.deviceID] = new RealtimeDeviceData(sample);
          }
      });
      if(syncAllDevices){
        // delete devices not in the newDeviceSamples
        let devicesMap = _.groupBy(newDeviceSamples, (sample: any) => sample.deviceID);
        Object.keys(this.devices).forEach(deviceID => {
          if(!devicesMap[deviceID]){
            delete this.devices[deviceID];
          }
        });
      }
  };

}

/* --------------------------------------------------------------
 * RealtimeDeviceData
 *
 * This class manages data for a single device and provides read/update
 * access to the data. The incoming data would be a series of samples which
 * includes a timestamp and the device metrics (e.g. position of a car).
 * For such series of data, this class provides linear approximation for
 * the metrics for any timestamp.
 */
export class RealtimeDeviceData {
  latestInfo = null;
  latestSample = null;
  samples: any[];
  deviceID: string;
  vehicle: any;

  constructor(initialSample){
    var s0 = Object.assign({}, initialSample);
    s0.t = 0; // move to epoc
    this.samples = [s0];
    this.deviceID = s0.deviceID;
    // add sample
    this.addSample(initialSample);
  }

  getAt(animationProgress) {
    var linearApprox = function (s0, s1, prop, t) {
        var t0 = s0.t, t1 = s1.t, v0 = s0[prop], v1 = s1[prop];
        if (t1 == t0)
            return v1; // assume that t0 < t1
        var r = ((v1 - v0) / (t1 - t0)) * (t - t0) + v0;
        return r;
    };
    var r = null; // result
    var i_minus_1 = this.samples.length - 1;
    while (i_minus_1 >= 0 && this.samples[i_minus_1].t > animationProgress) {
        i_minus_1--;
    }
    var i = i_minus_1 + 1;
    if (0 <= i_minus_1 && i < this.samples.length) {
        var s0 = this.samples[i_minus_1];
        var s1 = this.samples[i];
        r = Object.assign({}, s1);
        ['lat', 'lng'].forEach(function (prop) {
            r[prop] = linearApprox(s0, s1, prop, animationProgress);
        });
    }
    else if (i_minus_1 == this.samples.length - 1) {
        var s0 = this.samples[i_minus_1];
        r = s0; // no approximation
    }
    else if (i == 0 && i < this.samples.length) {
        var s0 = this.samples[i];
        r = s0; // no approximation
    }
    else
        throw new Error('Never');
    this.removeOldSamples(animationProgress);
    return r;
  }

  public addSample(sample, animationProgress?) {
    // add missing props from previous sample
    var prev = this.samples.length > 0 ? this.samples[this.samples.length - 1] : null;
    if (prev) {
        Object.keys(prev).forEach(function (prop) {
            if (typeof sample[prop] === 'undefined')
              sample[prop] = prev[prop];
        });
    }
    // update considering sample time
    sample.t = sample.t || sample.lastEventTime || sample.lastUpdateTime || (new Date().getTime());
    if (sample.t > this.samples[this.samples.length - 1].t) {
        this.samples.push(sample);
    }
    else if (sample.t < this.samples[this.samples.length - 1].t) {
        console.log('sample is reverted by %d', this.samples[this.samples.length - 1].t - sample.t);
    }
    else {
        this.samples[this.samples.length - 1] = sample; // replace
    }
    this.removeOldSamples(animationProgress);
    // update the latest additional info
    this.latestSample = sample;
    if (sample.info)
        this.latestInfo = sample.info;
  };
  removeOldSamples(animationProgress) {
    if (!animationProgress)
        return;
    // remove old samples
    var i = this.samples.findIndex(function (s) { return (s.t > animationProgress); });
    var deleteCount;
    if (i == -1) {
        // when there is no data newer than sim_now, we keep the last `1`
        deleteCount = this.samples.length - 1; // '1' is the number of samples that we need to retain
    }
    else {
        // keep `1` old data
        deleteCount = i - 1;
    }
    if (deleteCount > 1)
        this.samples.splice(0, deleteCount);
  };
}
