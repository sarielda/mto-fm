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

@Injectable()
export class LocationService {
  constructor() {  }

  //
  // Area is for focusing on a small region.
  // - to set location, `center` (and `zoom`) or `extent` property
  //   - the default zoom value is 15
  //
  areas: MapArea[] = [
    {id: 'vegas1'  , name: 'MGM Grand, Las Vegas', center:  [-115.1664377,36.102894]},
    {id: 'vegas2' ,name: 'Mandalay Bay, Las Vegas', center:  [-115.177541,36.093703]},
    {id: 'munch1'  ,name: 'Hellabrunn Zoo, Munich', center:  [11.558721,48.100317]},
    {id: 'munch2'  ,name: 'Nymphenburg Palace, Munich', center:  [11.555974,48.176261]},
    {id: 'tokyo1', name: 'Tokyo, Japan', center: [139.731992, 35.709026] },
  ];

  //
  // Track current position from GPS
  //
  private currentArea: MapArea;

  //
  // Region is wider than area, e.g. to track the number of cars
  //
  regions: MapArea[] = [
    {id: 'vegas'  ,name: 'Las Vegas', extent: [-116.26637642089848,35.86905016413695,-114.00868599121098,36.423521308323046]},
    {id: "munich" ,name: 'Munich, Germany', extent: [10.982384418945298,48.01255711693946,12.111229633789048,48.24171763772631]},
    {id: 'tokyo'  ,name: 'Tokyo, Japan', extent:  [139.03856214008624,35.53126066670448,140.16740735493002,35.81016922341598]},
    {id: "toronto",name: 'Toronto, Canada', extent: [-80.69297429492181,43.57305259767264,-78.43528386523431,44.06846938917488]},
  ];

  //
  // Track visible extent in Map
  //
  private mapRegion: MapArea;

  getAreas():MapArea[]{
    return this.areas;
  }
  getCurrentAreaRawSync():MapArea{
    return this.currentArea;
  }
  getCurrentArea(chooseNearestFromList = false):Promise<MapArea>{
    return new Promise((resolve, reject) => {
      var chooseNearest = (from) => {
        // when the location is not "last selected", re-select the map location depending on the current location
        var current_center = from.center;
        var nearest = _.min(this.areas, area => {
            if((area.id && area.id.indexOf('_') === 0) || !area.center) return undefined;
            // approximate distance by the projected map coordinate
            var to_rad = function(deg){ return deg / 180 * Math.PI; };
            var r = 6400;
            var d_lat = Math.asin(Math.sin(to_rad(area.center[1] - current_center[1]))); // r(=1) * theta
            var avg_lat = (area.center[1] + current_center[1]) / 2
            var lng_diff = _.min([Math.abs(area.center[0] - current_center[0]), Math.abs(area.center[0] + 360 - current_center[0]), Math.abs(area.center[0] - 360 - current_center[0])]);
            var d_lng = Math.cos(to_rad(avg_lat)) * to_rad(lng_diff); // r * theta
            var d = Math.sqrt(d_lat * d_lat + d_lng * d_lng);
            //console.log('Distance to %s is about %f km.', area.id, d * 6400);
            return d;
        });
        if(nearest.id){
          return nearest;
        }
        return from;
      }

      if(this.currentArea){
        var r = chooseNearestFromList ? chooseNearest(this.currentArea) : this.currentArea;
        return resolve(r);
      }
      if(navigator.geolocation){
        navigator.geolocation.getCurrentPosition(pos => {
            var current_center = [pos.coords.longitude, pos.coords.latitude];
            this.currentArea = {id: '_current', name: 'Current Location', center: current_center};
            var r = chooseNearestFromList ? chooseNearest(this.currentArea) : this.currentArea;
            return resolve(r);
        });
      }else{
        return reject();
      }
    });
  }
  getRegions():MapArea[]{
    return this.regions;
  }
  getMapRegion():MapArea{
    return this.mapRegion;
  }
  setMapRegionExtent(extent: number[]){
    if(!this.mapRegion || this.mapRegion.id !== '_last_selected'){
      this.mapRegion = {id: '_last_selected', name: 'Last Selected Area in Map', extent: extent};
    }else{
      this.mapRegion.extent = extent;
    }
  }

}

export interface MapArea {
  id: string;
  name: string;
  center?: number[],
  extent?: number[]
};
