/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
/*
 * Service to manage geofence
 */
angular.module('htmlClient')
.factory('geofenceService', function($q, $http, mobileClientService) {
	var service = {
		/*
		 * geofence json
		 * {
		 * 		direction: "in" or "out", "out" by default
		 * 		area_type: "rectangle" or "circle", "rectangle" by default
		 * 		area: {
		 * 			min_latitude: start latitude of geo fence, valid when area_type is rectangle
		 * 			min_longitude: start logitude of geo fence, valid when area_type is rectangle 
		 * 			max_latitude:  end latitude of geo fence, valid when area_type is rectangle
		 * 			max_longitude:  start logitude of geo fence, valid when area_type is rectangle
		 * 			latitude: center latitude of geo fence, valid when area_type is circle
		 * 			longitude: center logitude of geo fence, valid when area_type is circle 
		 * 			radius: radius of geo fence, valid when area_type is circle 
		 * 		}
		 * }
		 */

	   queryGeofences: function(params) {
		   var url = "/user/geofence";
		   var prefix = "?";
		   for (var key in params) {
			   url += (prefix + key + "=" + params[key]);
			   prefix = "&";
		   }
		   console.log("query event: " + url);
			
		   var deferred = $q.defer();
		   $http(mobileClientService.makeRequestOption({
			   method: "GET",
			   url: url
		   })).success(function(data, status){
			   deferred.resolve(data);
		   }).error(function(error, status){
			   deferred.reject({error: error, status: status});
		   });
		   return deferred.promise;
	   },

	   getGeofence: function(event_id) {
		   var url = "/user/geofence?geofence_id=" + event_id;
		   console.log("get geofence: " + url);
	     
		   var deferred = $q.defer();
		   $http(mobileClientService.makeRequestOption({
			   method: "GET",
			   url: url
		   })).success(function(data, status){
			   deferred.resolve(data);
		   }).error(function(error, status){
			   deferred.reject({error: error, status: status});
		   });
		   return deferred.promise;
	   },
	   
		createGeoFence: function(geofence) {
			if (!geofence) {
				geofence = {
					direction: "out",
					area_type: "rectangle",
					area: {
						min_latitude: 35.6131681266,
						min_longitude: 139.665536202,
						max_latitude: 35.6157760187,
						max_longitude: 139.672011055
					}
				};
			}
	    	
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "POST",
				url: "/user/geofence",
				headers: {
					'Content-Type': 'application/JSON;charset=utf-8'
				},
				data: {geofence: geofence}
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},

		deleteGeoFence: function(id) {
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "DELETE",
				url: "/user/rule/" + id
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		}
    };
    
    return service;
})
;