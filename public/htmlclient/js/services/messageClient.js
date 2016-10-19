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
 * Service that encapsulates message client. Implement this when connecting via MQTT 
 */
angular.module('htmlClient')
.factory('messageClientService', function($q, $timeout, $http, mobileClientService) {
	return {
		isValid: function() {
			return true;
		},
		create: function(credentials) {
		},
		destroy: function() {
		},
		connect: function(deviceId) {
	    	var deferred = $q.defer();
			deferred.resolve();
			return deferred.promise;
		},
		disconnect: function() {
	    	var deferred = $q.defer();
			deferred.resolve();
			return deferred.promise;
		},
		publish: function(data) {
			// Send data 
			var deferred = $q.defer();
			var request = mobileClientService.makeRequestOption({
				method : 'POST',
				url : '/user/probeData',
				data: data
			});
			$http(request).success(function(data, status) {
				deferred.resolve(data);
				console.log("sent data");
			}).error(function(error, status) {
				deferred.reject(error);
				console.log("failed to send data");
			});
	        return deferred.promise;
		}
	};
})
;