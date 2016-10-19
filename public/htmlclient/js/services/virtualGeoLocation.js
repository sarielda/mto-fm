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
 * Service to simulate geolocation
 */
angular.module('htmlClient')
.factory('virtualGeoLocation', function($q, $interval, $http, mobileClientService) {
    var service = {
    	driving: false,
    	tripRouteIndex: 0,
    	tripRoute: null,
    	prevLoc: {lat:48.134994,lon:11.671026,speed:0,init:true},
    	destination: null,
    	options: {avoid_events: true, route_loop: true},
    	
    	watchPosition: function(callback){
    		if(!this.tripRoute) {
    			this._resetRoute();
    		}
    		this.driving = true;
    		var self = this;
    		return $interval(function(){
    			self.getCurrentPosition(callback);
    		}, 1000);
    	},
    	clearWatch: function(watchId){
			$interval.cancel(watchId);
    		this.driving = false;
    	},
    	setOption: function(key, value) {
    		this.options[key] = value;
    	},
    	getOption: function(key) {
    		return this.options[key];
    	},
    	setCurrentPosition: function(loc /* lat, lon */, donotResetRoute){
    		if(this.driving){
    			// under driving
    			return;
    		}
    		this.prevLoc = loc;
    		if(isNaN(this.prevLoc.speed)){
    			this.prevLoc.speed = 0;
    		}
    		return donotResetRoute ? null : this._resetRoute();
    	},
    	updateRoute: function(locs) {
    		if (!locs) {
    			return this._resetRoute();
    		}
			var deferred = $q.defer();
			self = this;
			this._createRoutes(locs, true).then(function(routeArray){
				self.tripRouteIndex = 0;
				self.tripRoute = routeArray;
				self.prevLoc = routeArray[0];
				deferred.resolve(routeArray);
			})["catch"](function(error){
				deferred.reject(error);
			});
    		return deferred.promise;
    	},
    	setDestinationPosition: function(loc){
    		if(this.driving){
    			// under driving
    			return;
    		}
    		this.destination = loc;
    		return this._resetRoute();
    	},
    	getDestination: function() {
    		return this.destination;
    	},
    	getCurrentPosition: function(callback){
    		var p = this._getCurrentPosition();
    		if(p && !p.init){
    			callback({
    				coords: {
    					latitude: p.lat,
    					longitude: p.lon,
    					speed: p.speed*1000/3600,
    					heading: p.heading
    				}
    			});
    		}else{
	    		var self = this;
	    		if(navigator.geolocation){
		    		navigator.geolocation.getCurrentPosition(function(position){
		    			var c = position.coords;
		    			self.setCurrentPosition({lat:c.latitude, lon:c.longitude, speed: c.speed}, true);
		    			callback(position);
		    		});
		    	}else{
	    			callback({coords:{latitude:this.prevLoc.lat, longitude:this.prevLoc.lon, speed:this.prevLoc.speed}});
		    	}
    		}
    	},
    	
    	// find a random location in about 5km from the specified location
    	_getDestLoc: function(slat, slng, heading){
			var ddist = (Math.random()/2 + 0.5) * 0.025 / 2;
			var dtheta = 2 * Math.PI * Math.random();
			var dlat = 0;
			var dlng = 0;
			if(this.destination){
				dlat = this.destination.lat;
				dlng = this.destination.lon;
			}else{
				dlat = +slat + ddist * Math.sin(dtheta);
				dlng = +slng + ddist * Math.cos(dtheta);
			}
			return {lat: dlat, lng: dlng, heading: (this.destination ? this.destination.heading : heading)};
		},
		
		// reset trip route
		_resetRoute:function(){
			var deferred = $q.defer();
			var slat = this.prevLoc.lat;
			var slng = this.prevLoc.lon;
			var sheading = this.prevLoc.heading;
			
			var loop = !this.destination || (this.options && this.options.route_loop);
			var locs = [];
			locs.push({lat: slat, lng: slng, heading: sheading});
			locs.push(this._getDestLoc(slat, slng, sheading));
			if (!this.destination) {
				locs.push(this._getDestLoc(slat, slng, sheading));
			}

			self = this;
			this._createRoutes(locs, loop).then(function(routeArray){
				self.tripRouteIndex = 0;
				self.tripRoute = routeArray;
				self.prevLoc = routeArray[0];
				deferred.resolve(routeArray);
			})["catch"](function(error){
				deferred.reject(error);
			});
    		return deferred.promise;
    	},
    	
    	_createRoutes: function(locs, loop) {
    		var promises = [];
    		var routeArrays = {};
    		for (var i = 0; i < locs.length - (loop ? 0 : 1); i++) {
    			var deferred = $q.defer();
    			var loc1 = locs[i];
    			var loc2 = (i < locs.length - 1) ? locs[i+1] : locs[0];
    			var index = "index" + i;
    			promises.push($q.when(this._findRoute(0, loc1, loc2, index), function(result) {
    				routeArrays[result.id] = result.route;
					return result;
				}, function(error) {
					return null;
				}));
    		}
    		
			var deferred = $q.defer();
			$q.all(promises).then(function(routes) {
				var routeArray = [];
	    		for (var i = 0; i < promises.length; i++) {
	    			var r = routeArrays["index" + i];
	    			if (r === null) {
	    				return deferred.reject();
	    			}
	    			routeArray = routeArray.concat(r);
	    		}
	    		deferred.resolve(routeArray);
			});
    		return deferred.promise;
    	},
    	
    	// find a route from a specific location to a specific location
    	_findRoute:function(retryCount, start, end, searchId){
    		var retryCount = retryCount || 0;
    		var deferred = $q.defer();
			var self=this;

			// make URL
			var url = "/user/routesearch?orig_latitude=" + start.lat + "&orig_longitude=" + start.lng + "&dest_latitude=" + end.lat + "&dest_longitude=" + end.lng;
			if (!isNaN(start.heading)) {
				url += "&orig_heading=" + start.heading;
			}
			if (!isNaN(end.heading)) {
				url += "&dest_heading=" + end.heading;
			}
			if(this.options && this.options.avoid_events) {
				url += "&option=avoid_event";
			}
			
			$http(mobileClientService.makeRequestOption({
				method: "GET",
				url: url
			})).success(function(data, status){
				var routeArray = [];
				data.link_shapes.forEach(function(shapes){
					shapes.shape.forEach(function(shape){
						if(shape)
							routeArray.push(shape);
					});
				});
				if(routeArray.length >= 2){
					deferred.resolve(searchId ? {id: searchId, route: routeArray} : routeArray);
					return;
				}else if(retryCount++ < 5){
					// retry 5 times
					console.log("failed to search route. retry[" + retryCount + "]");
					return self._findRoute(retryCount, start, end, searchId).then(function(result){
						deferred.resolve(searchId ? {id: searchId, route: result} : result);
					});
				}
				console.error("Cannot get route for simulation");
				deferred.reject();
			}).error(function(error, status){
				console.error("Error[" + status + "] in route search: " + error);
				deferred.reject();
			});
			return deferred.promise;
    	},
    	
    	_getCurrentPosition: function(){
			if(!this.tripRoute || this.tripRoute.length < 2){
				return this.prevLoc;
			}
			var prevLoc = this.prevLoc;
			var loc = this.tripRoute[this.tripRouteIndex];
			var speed = this._getDistance(loc, prevLoc)*0.001*3600;
			while((speed - prevLoc.speed) < -20 && this.tripRouteIndex < this.tripRoute.length-1){ 
				// too harsh brake, then skip the pointpoint
				this.tripRouteIndex++;
				loc = this.tripRoute[this.tripRouteIndex];
				speed = this._getDistance(loc, prevLoc)*0.001*3600;
			}
			while(speed>120 || (speed - prevLoc.speed) > 20){
				// too harsh acceleration, then insert intermediate point
				var loc2 = {lat: (+loc.lat+prevLoc.lat)/2, lon: (+loc.lon+prevLoc.lon)/2};
				speed = this._getDistance(loc2, prevLoc)*0.001*3600;
				this.tripRoute.splice(this.tripRouteIndex, 0, loc2);
				loc = loc2;
			}
			loc.speed = speed
			// calculate heading
			var rad = 90 - Math.atan2(Math.cos(prevLoc.lat/90)*Math.tan(loc.lat/90)-Math.sin(prevLoc.lat/90)*Math.cos((loc.lon-prevLoc.lon)/180),
					Math.sin((loc.lon-prevLoc.lon)/180)) / Math.PI * 180;
			loc.heading = (rad + 360)%360;
			// keep the previous info
			this.prevLoc = loc;

			this.tripRouteIndex++;
			if(this.tripRouteIndex >= this.tripRoute.length){
				if (this.destination && !(this.options && this.options.route_loop)) {
					this.tripRouteIndex--;
				} else {
					this.tripRouteIndex = 0;
				}
			}
			return loc;
    	},
    	/*
		 * Calculate distance in meters between two points on the globe
		 * - p0, p1: points in {latitude: [lat in degree], longitude: [lng in degree]}
		 */
		_getDistance: function(p0, p1) {
			// Convert to Rad
			function to_rad(v) {
				return v * Math.PI / 180;
			}
			var latrad0 = to_rad(p0.lat);
			var lngrad0 = to_rad(p0.lon);
			var latrad1 = to_rad(p1.lat);
			var lngrad1 = to_rad(p1.lon);
			var norm_dist = Math.acos(Math.sin(latrad0) * Math.sin(latrad1) + Math.cos(latrad0) * Math.cos(latrad1) * Math.cos(lngrad1 - lngrad0));
			
			// Earths radius in meters via WGS 84 model.
			var earth = 6378137;
			return earth * norm_dist;
		}
    };
    return service;
})
;