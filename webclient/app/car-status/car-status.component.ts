/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

import { RealtimeDeviceData } from '../shared/realtime-device';
import { RealtimeDeviceDataProviderService } from '../shared/realtime-device-manager.service';
import { CarStatusDataService } from './summary/car-status-data.service';

import * as _ from 'underscore';

@Component({
  moduleId: module.id,
  selector: 'fmdash-car-status',
  templateUrl: 'car-status.component.html',
})
export class CarStatusComponent implements OnInit {
  private mo_id: string;
  private moIdSubject = new Subject<string>();
  private proveDataSubscription;

  private device: RealtimeDeviceData;
  private probeData: any; // probe data to show

  constructor(
    private route: ActivatedRoute,
    private carStatusDataService: CarStatusDataService,
    private realtimeDataProviderService: RealtimeDeviceDataProviderService
  ){
  }

  ngOnInit() {
    var self = this;
    this.proveDataSubscription = this.moIdSubject.switchMap(mo_id => {
        // Start watching car probe of the vehicle. This method will monitor the car probe of the vehicle from whole world. 
        // It may result slow performance of querying car probe as the searching area is too large.
        this.realtimeDataProviderService.startTracking(mo_id);
        return mo_id ? this.carStatusDataService.getProbe(mo_id) : Observable.of([]);
      }).subscribe(probe => {
        // update data
        this.device = probe && this.realtimeDataProviderService.getProvider().getDevice(probe.mo_id);
        this.probeData = probe;

        // update overlay
        var cardOverlay = document.getElementById('cardOverlay');
        if (probe == null && cardOverlay.style.opacity != '1') {
            cardOverlay.style.opacity = '1';
            cardOverlay.style.display = 'block';
        } else if (probe != null && cardOverlay.style.opacity != '0') {
            cardOverlay.style.opacity = '0';
            cardOverlay.style.display = 'none';
        }
      });

    var mo_id: any;
    this.route.params.forEach((params: Params) => {
        mo_id = mo_id || params['mo_id'];
     });
    this.mo_id = <string>mo_id;
    this.moIdSubject.next(mo_id);

    var modalCallsArray = Array.prototype.slice.call(document.querySelectorAll('.numCounter'), 0);

    modalCallsArray.forEach(function(el) {
            console.log(el.innerHTML);

            var number = parseInt(el.innerHTML);
            var delay = number;

            // 1500 is animation duration in milliseconds (1.5s)
            var delayAccum = 1500 / el.innerHTML;
            var accum = 1;

            for (var i=0; i < number; ++i) {
                    doSetTimeout(delay, el, accum);

                    accum += 1;
                    delay = delay + delayAccum;
            }
    });

    function doSetTimeout(delay, el, accum) {
      setTimeout(function() {
          el.innerHTML = accum;
      }, delay);
    }
  }

  ngOnDestroy(){
    if(this.proveDataSubscription){
      this.proveDataSubscription.unsubscribe();
      this.proveDataSubscription = null;
    }
  }
}
