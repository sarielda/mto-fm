/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, OnInit, AfterViewInit, Input, Inject, ViewChild } from '@angular/core';
import { ActivatedRoute, Params } from '@angular/router';

import { RealtimeMapComponent } from './realtime-map/realtime-map.component';
import { NumberOfCarsComponent } from './number-of-cars/number-of-cars.component';
import { LocationService, MapArea } from '../shared/location.service';
import { APP_CONFIG, AppConfig } from '../app-config';

import * as _ from 'underscore';

@Component({
  moduleId: module.id,
  selector: 'fmdash-map-page',
  templateUrl: 'map-page.component.html',
  styleUrls: ['map-page.component.css'],
  providers: [],
})
export class MapPageComponent implements OnInit, AfterViewInit {
  areas: MapArea[];
  regions: MapArea[];
  selectedArea: MapArea;
  mapLastSelectedArea: MapArea;
  showGuide: boolean = true;
  initialized: boolean = false;

  private initialVehicleId: string;
  @ViewChild(RealtimeMapComponent) realtimeMap: RealtimeMapComponent;

  //
  // Web API host
  //
  webApiBaseUrl: string;

  constructor(
    private route: ActivatedRoute,
    private locationService: LocationService,
    @Inject(APP_CONFIG) appConfig: AppConfig
  ) {
    this.webApiBaseUrl = window.location.protocol + '//' + appConfig.webApiHost;
    this.locationService = locationService;
    this.areas = locationService.getAreas().map(x=>x);
    this.regions = locationService.getRegions().map(x=>x);
  }

  onMapExtentChanged(event){
    let extent = event.extent;
    this.locationService.setMapRegionExtent(extent);
    this.mapLastSelectedArea = _.extend({}, this.locationService.getMapRegion()); // fire extent change
  }

  htmlClientInitialLocation(){
    let mapRegion = this.locationService.getMapRegion();
    let e = mapRegion && mapRegion.extent;
    if(e){
      var lng = (e[0] + e[2]) / 2, lat = (e[1] + e[3]) / 2;
      return '' + lat + ',' + lng;
    }
    return "";
  }

  ngOnInit() {
    this.checkGuidance();

   // get param from router
    this.route.params.forEach((params: Params) => {
      let id = params['vehicleId'];
      if(id) this.initialVehicleId = id;
    });

    // move location
    this.selectedArea = this.areas[this.areas.length - 1];
    if(this.locationService.getMapRegion()){
      if(this.locationService.getCurrentAreaRawSync()){
        this.areas.push(this.locationService.getCurrentAreaRawSync());
      }
      this.areas.push(this.locationService.getMapRegion());
      this.selectedArea = this.areas[this.areas.length - 1];
    } else {
      this.locationService.getCurrentArea().then(area => {
        if(this.locationService.getCurrentAreaRawSync()){
          this.areas.push(this.locationService.getCurrentAreaRawSync());
        }
        this.selectedArea = area;
      }).catch(ex => {
        this.selectedArea = this.areas[0];
      });
    }
  }
  ngAfterViewInit() {
     this.initialized = true;
     if(this.initialVehicleId){
      this.realtimeMap.selectDevice(this.initialVehicleId);
    }
  }
  openSimulator() {
    this.showGuide = false;
    let simulatorUrl = this.webApiBaseUrl + "/htmlclient/fleet.html?loc=" + this.htmlClientInitialLocation();
    window.open(simulatorUrl, 'htmlclient');
  }
  checkGuidance() {
    if (window.navigator.cookieEnabled) {
      let found = false;
      let hide_guide_key = "iota-fleetmanagement-hide-guide";
      if (document.cookie) {
        let cookies = document.cookie.split("; ");
        found = _.contains(_.map(cookies, function(cookie) {
		      return cookie.split("=")[0];
        }), hide_guide_key);
        this.showGuide = !found;
      }
      if (!found) {
        document.cookie = hide_guide_key + "=true";
      }
    }
  }
}
 
