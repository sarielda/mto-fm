/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, Input, OnInit, OnDestroy, AfterContentInit, ViewChild, OnChanges, SimpleChange } from '@angular/core';

import { Observable } from 'rxjs/Observable';
import { Subject } from 'rxjs/Subject';

var chartComponentNextId = 0;

@Component({
  moduleId: module.id,
  selector: 'status-meter',
  template: `
  <div class="row">
    <div class="column-6-med">
      <div class="row noOffsetRow">
        <div class="column-6-med">{{title}}</div>
        <div class="column-6-med">
          <strong class="carStatus-strong"
              [ngClass]="statusClassObj">
            <span class="numCounter">{{value}}</span>{{valueSuffix}}
          </strong>
          <br *ngIf="valueUnit" />{{valueUnit}}
        </div>
      </div>
    </div>
    <div class="column-6-med">
      <div class="speedometer-container" *ngIf="graphType==='gauge'">
        <div class="speedometer">
          <div class="pointer" id="speedometer-pointer" #speedometerDiv
              [ngClass]="statusClassObj"
              [style.transform]="'rotate(' + speedometerDeg + 'deg)'">
          </div>
          <div class="speedometer bottom-bar"></div>
        </div>
      </div>
      <div class="thermometer-container" *ngIf="graphType==='bar' || graphType==='temp-bar'">
          <ul class="thermometer">
              <li *ngFor="let i of thermometerTicks">
<!--                  <p class="frnh"><span *ngIf="graphType==='temp-bar'">{{(i * 1.8 + 32) | number}}</span></p>-->
                  <p class="cent">{{i}}</p>
              </li>
          </ul>
          <div class="thermometer-range" id="thermometer-range" #thermometerDiv
            [ngClass]="statusClassObj"
            [style.width]="thermometerPercent + '%'">
          </div>
      </div>
    </div>
  </div><!--end row-->
  `,
  providers: [],
})
export class StatusMeterComponent implements OnInit, OnDestroy, AfterContentInit, OnChanges {
  @Input() minValue: number;
  @Input() maxValue: number;
  @Input() tickStep = 30;
  @Input() title: string;
  @Input() valueSuffix: string;
  @Input() valueUnit: string;
  @Input() graphType = 'gauge'; // gauge or temp-bar

  @Input() value: number;
  @Input() status: string; // either 'critical', 'troubled', or 'normal'

  private barMinMaxAdjust = 2;
  private subject = new Subject<any>();
  private subscription;
  private statusClassObj = {};
  private speedometerDeg = -90;
  private thermometerPercent = 10;
  private thermometerTicks = [];

  @ViewChild('speedometerDiv') speedometerDiv;
  @ViewChild('thermometerDiv') thermometerDiv;

  constructor() {
  }

  ngOnInit() {
    // prepare ticks
    for(let i=this.minValue; i<=this.maxValue; i+=this.tickStep){
      this.thermometerTicks.push(i);
    }
  }

  ngAfterContentInit() {
    this.subscription = this.subject.debounceTime(100).distinctUntilChanged().subscribe(value => {
      var gaugeDiv = (this.speedometerDiv && this.speedometerDiv.nativeElement);
      var barDiv = (this.thermometerDiv && this.thermometerDiv.nativeElement);
      if(gaugeDiv){
        let ratio = (value.value - this.minValue) / (this.maxValue - this.minValue);
        ratio = Math.max(0, Math.min(1, ratio));
        this.speedometerDeg = Math.floor(ratio * 180 - 90);
        //gaugeDiv.style.transform = `rotate(${(ratio * 180 - 90).toFixed(0)}deg) !important`;
      }
      if(barDiv){
        let ratio = (value.value - (this.minValue - this.barMinMaxAdjust)) / ((this.maxValue + this.barMinMaxAdjust) - (this.minValue - this.barMinMaxAdjust));
        ratio = Math.max(0, Math.min(1, ratio));
        this.thermometerPercent = Math.floor(ratio * 100);
        //barDiv.style.width = `${(ratio * 100).toFixed(0)}% !important`;
      }
      var status = value.status;
      var obj = {red: status==='critical', orange: status==='troubled', green: status==='normal', blue: undefined };
      obj.blue = (!obj.red && !obj.orange && !obj.green);
      this.statusClassObj = obj;
    });
    this.fireChange();
  }

  ngOnDestroy() {
    if(this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  ngOnChanges(changes: { [key: string]: SimpleChange} ) {
    // translates @Input(s) to observable subjects
    let newValueChange = changes['value'];
    let newStatusChange = changes['status'];
    if (newValueChange || newStatusChange){
      this.fireChange();
    }
  }

  private fireChange(){
    this.subject.next({value: this.value, status: this.status});
  }
}
