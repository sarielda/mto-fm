/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Injectable } from "@angular/core";
import { HttpClient } from "./http-client";
import { Response, Headers, RequestOptions } from "@angular/http";
import { Observable } from "rxjs/Observable";

@Injectable()
export class GeofenceService {
  constructor (private http: HttpClient) {
  }

	/*
	 * geofence json
	 * {
	 * 		direction: "in" or "out", "out" by default
	 * 		geometry_type: "rectangle" or "circle", "rectangle" by default
	 * 		geometry: {
	 * 			min_latitude: start latitude of geo fence, valid when area_type is rectangle
	 * 			min_longitude: start logitude of geo fence, valid when area_type is rectangle
	 * 			max_latitude:  end latitude of geo fence, valid when area_type is rectangle
	 * 			max_longitude:  start logitude of geo fence, valid when area_type is rectangle
	 * 			latitude: center latitude of geo fence, valid when area_type is circle
	 * 			longitude: center logitude of geo fence, valid when area_type is circle
	 * 			radius: radius of geo fence, valid when area_type is circle
	 * 		},
   *    target: {
   *      area {
   * 	  		min_latitude: start latitude of geo fence target, valid when direction is out
	 * 		  	min_longitude: start logitude of geo fence target, valid when direction is out
	 * 		  	max_latitude:  end latitude of geo fence target, valid when direction is out
	 * 			  max_longitude:  start logitude of geo fence target, valid when direction is out
   *      }
   *    }
	 * }
	 */

   public queryGeofences(params): Observable<any> {
     let url = "/user/geofence";
     let prefix = "?";
     for (let key in params) {
        url += (prefix + key + "=" + params[key]);
        prefix = "&";
     }
     console.log("query event: " + url);

     return this.http.get(url).map(data => {
         let resJson = data.json();
         return resJson;
     });
   }

   public getGeofence(geofence_id: string) {
     let url = "/user/geofence/" + geofence_id;
     console.log("get geofence: " + url);

     return this.http.get(url).map(data => {
        let resJson = data.json();
        return resJson;
      });
   }

   public createGeofence(geofence) {
     let url = "/user/geofence";
     let body = JSON.stringify(geofence);
     let headers = new Headers({"Content-Type": "application/JSON;charset=utf-8"});
     let options = new RequestOptions({headers: headers});

     return this.http.post(url, body, options).map(data => {
        let resJson = data.json();
        return resJson;
      });
  }

   public updateGeofence(geofence_id, geofence) {
     let url = "/user/geofence/" + geofence_id;
     let body = JSON.stringify(geofence);
     let headers = new Headers({"Content-Type": "application/JSON;charset=utf-8"});
     let options = new RequestOptions({headers: headers});

     return this.http.put(url, body, options).map(data => {
        let resJson = data.json();
        return resJson;
      });
  }

  public deleteGeofence(id) {
    return this.http.delete("/user/geofence/" + id).map(data => {
        let resJson = data.json();
        return resJson;
    });
  }
}
