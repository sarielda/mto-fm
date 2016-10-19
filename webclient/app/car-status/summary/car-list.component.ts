/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit, OnDestroy, OnChanges, SimpleChange, Input } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';
import { CarStatusDataService } from './car-status-data.service';

import * as _ from 'underscore';

@Component({
  moduleId: module.id,
  selector: 'fmdash-car-list',
  templateUrl: 'car-list.component.html',
  styleUrls: ['../../../css/table.css'],
})
export class CarListComponent implements OnInit, OnDestroy, OnChanges {
  @Input() groupProp: string;
  @Input() selectGroup: string;
  get groupPropName() { return this.groupProp === 'fuel' ? 'Fuel' : (this.groupProp === 'engineTemp' ? 'Engine Oil Temperature': this.groupProp); }
  get selectGroupName() { return this.selectGroup; }
  private selectionSubject = new Subject<any>();
  private selectedDeviesSubscription;
  public devices = [];

  constructor(private carStatusDataService: CarStatusDataService) {  }

  ngOnInit() {
    this.selectedDeviesSubscription = this.selectionSubject
      .map(x => { console.log(x); return x; })
//      .debounceTime(500)
//      .distinctUntilChanged()
      .switchMap(sel => {
          console.log('Switching to ' , sel);
          if(sel.value){
            return this.carStatusDataService.getDevices(sel.prop, sel.value, 5);
          }
          return Observable.of([]);
        }
      )
      .catch(error => {
        console.log(error);
        return Observable.of([]);
      })
      .subscribe(devices => {
        this.devices = devices.map(device => device);
        console.log('Setting probes to; ', this.devices);
      });
  }
  ngOnDestroy() {
    if(this.selectedDeviesSubscription){
      this.selectedDeviesSubscription.unsubscribe();
      this.selectedDeviesSubscription = null;
    }
  }

  ngOnChanges(changes: { [key: string]: SimpleChange} ) {
    // translates @Input(s) to observable subjects
    let newGroupPropChange = changes['groupProp'];
    let newSelectGroupChange = changes['selectGroup'];
    if(newGroupPropChange || newSelectGroupChange){
      this.selectionSubject.next({prop: this.groupProp, value: this.selectGroup});
      console.log('Sent to subject: [' + this.groupProp + '] => [' + this.selectGroup + ']');
    }
  }
}
