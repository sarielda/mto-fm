/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit, ViewChild } from '@angular/core';
import { Http, Request, Response } from '@angular/http';

import { VehicleListComponent } from './vehicle-list/vehicle-list.component';
import { VendorListComponent } from './vendor-list/vendor-list.component';

@Component({
  moduleId: module.id,
  selector: 'fmdash-vehicle-page',
  templateUrl: 'vehicle-page.component.html',
})
export class VehiclePageComponent implements OnInit {

  @ViewChild(VehicleListComponent)
  private vehicleList: VehicleListComponent;

  @ViewChild(VendorListComponent)
  private vendorList: VendorListComponent;

  isWorkingWithVendor: boolean;
  isIoTPAvailable: boolean = false;

  constructor(public http:Http) {

  }

  ngOnInit() {
    this.http.get("/user/capability/device")
    .subscribe((response: any) => {
      let res = response.json();
      this.isIoTPAvailable = res.available;
    });
  }

  onSyncWithIoTPlatform() {
    this.vehicleList.onSyncWithIoTPlatform();
  }

  onCreateVehicle() {
    this.vehicleList.onCreate();
  }

  onCreateVendor() {
    this.vendorList.onReload();
    this.isWorkingWithVendor = true;
  }

  onClose() {
    this.isWorkingWithVendor = false;
  }
}
