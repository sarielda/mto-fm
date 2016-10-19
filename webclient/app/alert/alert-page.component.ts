/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit } from '@angular/core';
import { Http, Request, Response } from '@angular/http';
import { ActivatedRoute, Params } from '@angular/router';

import { AlertListComponent } from './alert-list/alert-list.component';

@Component({
  moduleId: module.id,
  selector: 'fmdash-fleet-alert',
  templateUrl: 'alert-page.component.html',
})

export class AlertPageComponent implements OnInit {
  private extent: number[];
  private filterProp = '';
  private filterValue = '';
  private includeClosed = true;
  private showInput = true;

  constructor(private route: ActivatedRoute){
  }

  ngOnInit(): void {
    var extent: any, status: any;
    this.route.params.forEach((params: Params) => {
      extent = extent || params['extent'];// extent is comma-separated list of min_lng, min_lat, max_lng, max_lat
      status = status || params['status'];
    });

    if(extent){
      if(extent.length == 4){
        this.extent = extent;
      }else{
        var splited = extent.split(",");
        if(splited.length === 4 && splited.every((n) => {return !isNaN(n)})){
          this.extent = splited;
        }else{
          this.extent = undefined;
        }
      }
    } else {
      this.extent = undefined;
    }

    if(status === 'critical'){
      this.filterProp = 'severity';
      this.filterValue = 'High'; // FIXME: tentative. "Critical|High" is expected
      this.includeClosed = false;
      this.showInput = false;
    } else if (status === 'troubled'){
      this.filterProp = 'all';
      this.filterValue = 'all'; // assign temp value to hide control panels
      this.includeClosed = false;
      this.showInput = false;
    } else {
      this.filterProp = '';
      this.filterValue = '';
      this.includeClosed = true;
      this.showInput = true;
    }
  }
}
