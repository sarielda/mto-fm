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
 * Service to manage events
 */
angular.module('htmlClient')
.factory('eventService', function($q, $http, mobileClientService) {
	var service = {
		getEventTypes: function() {
	    	var url = "/user/eventtype";
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "GET",
				url: url
			})).success(function(data, status){
				deferred.resolve(data.data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		queryEvents: function(params, activeOnly) {
			var self = this;
	    	var url = "/user/event/query";
	    	var prefix = '?';
	    	for (var key in params) {
	    		url += (prefix + key + '=' + params[key]);
	    		prefix = '&';
	    	}
	    	console.log("query event: " + url);
	    	
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "GET",
				url: url
			})).success(function(data, status){
				if (data && activeOnly) {
					data = data.filter(function(event) {
						return self.isActiveEvent(event); 
					});
				}
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},

		getEvent: function(event_id) {
	    	var url = "/user/event?event_id=" + event_id;
	    	console.log("get event: " + url);
	    	
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

		createEvent: function(event) {
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "POST",
				url: "/user/event",
				headers: {
					'Content-Type': 'application/JSON;charset=utf-8'
				},
				data: event
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},

		deleteEvent: function(event_id) {
	    	var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "DELETE",
				url: "/user/event?event_id=" + event_id
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		isActiveEvent: function(event) {
			if (!event.start_time && !event.end_time) {
				return true;
			}
			var current = Date.now();
			if (event.start_time) {
				try {
					var t = Date.parse(event.start_time);
					if (current < t) {
						return false;
					}
				} catch(e) {
					return false;
				}
			}
			if (event.end_time) {
				try {
					var t = Date.parse(event.end_time);
					if (t < current) {
						return false;
					}
				} catch(e) {
					return false;
				}
			}
			return true;
		}
    };
    
    return service;
})
;