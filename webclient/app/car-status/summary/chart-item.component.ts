/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, EventEmitter, AfterContentInit, Input, Output, ViewChild, ContentChild } from '@angular/core';

import { RealtimeDeviceData, RealtimeDeviceDataProvider } from '../../shared/realtime-device';
import { CarStatusDataService } from './car-status-data.service';

import * as c3 from 'c3';

@Component({
  moduleId: module.id,
  selector: 'fmdash-chart-item',
  templateUrl: 'chart-item.component.html',
})
export class ChartItemComponent implements AfterContentInit {
  @Input() title: string;
  @Input() chartType = 'donut';
  @Input() chartRotated: string;
  @Input() aggrKey: string;
  @Output() selectionChange = new EventEmitter<any>();
  @ViewChild('chartDiv') chartDiv;

  private chartId = 'chart_' + (Math.floor(Math.random() * 1000000000));

  private chartSelector: string;
  private chart: c3.ChartAPI;

  private dataSubscription;

  constructor(
    private carStatusData: CarStatusDataService
  ) {
    this.chartSelector = '#' + this.chartId;
  }

  ngAfterContentInit() {
//    var e = this.chartDiv.nativeElement
    var opts = {
      bindto: this.chartSelector,
      data: {
        columns: [],
        type: this.chartType,
        order: null,
        selection: {enabled: false},
        // onselected: (d => {
        //   // console.log(d)
        //   // var allSelected = <any>this.chart.selected();          console.log(allSelected);
        //   // var toDeselect = allSelected.filter(sel => sel !== d).map(sel => sel.id);
        //   // this.chart.unselect(toDeselect);
        //   this.selectionChange.emit({key: this.aggrKey, value: d.id});
        // }),
        // onunselected: (d => {
        //   this.selectionChange.emit({key: this.aggrKey, value: null});
        // }),
        onclick: (d => {
          this.selectionChange.emit({key: this.aggrKey, value: d.id});
        }),
      },
      color: {
        pattern: ['#f05153','#f67734','#58a946', '#3774ba', '#01b39e']
      },
      axis: {
        rotated: (this.chartRotated === 'true'),
      },
    };
    if (this.chartType === 'donut'){
      (<any>opts).donut = {
        title: this.title,
      };
    }
    setTimeout(() => {
      this.chart = c3.generate(opts);
      // keep sending data
      this.dataSubscription = this.carStatusData.getColumns(this.aggrKey)
        .distinctUntilChanged((x, y) => _.isEqual(x, y))
        .subscribe(data => {
          this.chart.load({columns: data});
        });
    }, 100);

  }

  ngOnDestroy() {
    if(this.dataSubscription){
      this.dataSubscription.unsubscribe();
      this.dataSubscription = null;
    }
  }

  private refresh(data){
    // update chart if the chart library is loaded
    if(this.chart && this.chart.load){
      this.chart.load({
        columns: data.columns,
      });
    }

    // update title
    if (this.chartType === 'donut'){
      let sel = d3.select(this.chartSelector + ' .c3-chart-arcs-title');
      (<any>sel.node()).innerHTML = 'Avg: ' + parseFloat(data.average).toFixed(1);
      sel.attr('fill', '#3a6284');
      sel.style('padding-top', '6px');
      sel.style('font-size', '24px');
      sel.style('font-weight', '500');
    }
  }




}
