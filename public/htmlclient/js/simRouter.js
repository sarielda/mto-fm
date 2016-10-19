/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var $stateProviderRef = null;
 
angular.module('fleetManagementSimulator', ['ui.router', 'ngAnimate'])
	.config(['$locationProvider', '$stateProvider', function($locationProvider, $stateProvider) {
		$locationProvider.html5Mode(true); 
		$stateProviderRef = $stateProvider;
	}])
 
	/* === GENERAL CONTROLLERS === */
	.controller('mainCtrl', ['$scope', '$state', '$http', '$sce', '$location', '$window', '$timeout', function($scope, $state, $http, $sce, $location, $window, $timeout) {
		$scope.pageLoaded = false;

		$window.onbeforeunload = function (e) {
			// inactivate when user closes simulator window
			$scope.vehicles.forEach(function(v){
				$http({
					method: "PUT",
					url: "/user/vehicle/" + v.mo_id + "?addition=true",
					headers: {
						"Content-Type": "application/JSON;charset=utf-8"
					},
					data: {mo_id: v.mo_id, status: "inactive"}
				});
			});
			$timeout(function(){}, 3000);
			return "Top simultors?";
		};
		
		$scope.busy = true;
		$scope.vehicleStatus = {};
		$scope.requestIds = {};
		$scope.vehiclesToBeInitialzed = [];

		function _updateVehicleStatus(id, key, value) {
			if (!$scope.vehicleStatus[id]) {
				return;
			}
			var busy = false;
			$scope.vehicleStatus[id][key] = value;
			for (var k in $scope.vehicleStatus) {
				if ($scope.vehicleStatus[k].busy) {
					busy = true;
					break;
				}
			}
			$scope.busy = busy;
		}
		
		function _postMessageToVehicle(message, vehicle) {
			var id = vehicle.mo_id;
			var vehicle_node = document.getElementById(id);
			if (vehicle_node && vehicle_node.contentWindow) {
				if (!$scope.requestIds[message]) {
					$scope.requestIds[message] = [id];
				} else if ($scope.requestIds[message].indexOf(id) < 0) {
					$scope.requestIds[message].push(id);
				}
				_updateVehicleStatus(id, "busy", true);
				var messageObj = {message: message, requestId: id};
				var messageStr = JSON.stringify(messageObj);
				vehicle_node.contentWindow.postMessage(messageStr, "*");
			}
		}
		
		function _postMessageToVehicles(message) {
			$scope.vehicles.forEach(function(vehicle) {
				_postMessageToVehicle(message, vehicle);
			});
		}
		
		$window.addEventListener('message', function(e) {
        	if ($window.location.origin !== e.origin, 0) {
        		return;
        	}
        	var message = JSON.parse(e.data);
        	if (message.requestId) {
        		if (message.requestMessage === "simulator-set-message-target") {
        			var index = $scope.vehiclesToBeInitialzed.indexOf(message.requestId);
        			if (index >= 0) {
        				$scope.vehiclesToBeInitialzed.splice(index, 1);
        				$scope.busy = $scope.requestIds.length > 0;
        			}
        		} else {
            		var requestIds = $scope.requestIds[message.requestMessage];
            		var index = requestIds.indexOf(message.requestId);
            		if (index >= 0) {
            			requestIds.splice(index, 1);
            		}
            		if (requestIds.length === 0) {
            			if (message.requestMessage === "simulator-start-all") {
                			$scope.requestingStarting = false;
                    		$scope.$apply();
            			} else if (message.requestMessage === "simulator-stop-all") {
                			$scope.requestingStopping = false;
                    		$scope.$apply();
            			}
            		}
            	}
       		}
        	if (message.message === "status") {
				_updateVehicleStatus(message.mo_id, "busy", message.busy);
				_updateVehicleStatus(message.mo_id, "driving", message.driving);
	    		$scope.$apply();
       	}
        });
		
		function _checkStarted() {
			if ($scope.vehiclesToBeInitialzed.length == 0) {
				$scope.busy = $scope.requestIds.length > 0;
				return;
			}
			$scope.busy = true;
			$scope.vehiclesToBeInitialzed.forEach(function(id) {
				var vehicle_node = document.getElementById(id);
				if (vehicle_node && vehicle_node.contentWindow) {
					var messageObj = {message: "simulator-set-message-target", requestId: id};
					var messageStr = JSON.stringify(messageObj);
					vehicle_node.contentWindow.postMessage(messageStr, "*");
				}
			});
			setTimeout(_checkStarted, 1000);
		}
		
		window.onFrameLoaded = function(id) {
			if (this.initialMessageTimeout) {
				clearTimeout(this.initialMessageTimeout);
				this.initialMessageTimeout = null;
			}
			var self = this;
			this.initialMessageTimeout = setTimeout(function(){
				self.initialMessageTimeout = null;
				_checkStarted();
			}, 1000);
		};
		
		var oldDate = (new Date(0)).toUTCString(); // to avoid IE cache issue
		// Get simulation vehicles
		$http({
			method: "GET",
			url: "/user/simulatedVehicles",
			headers: {
				"If-Modified-Since": oldDate
			}
		}).success(function(data, status){					
			var vehicles = data.data || []; 
			if(vehicles.length > 5){
				vehicles = vehicles.slice(0, 5);
			}
			$scope.vehiclesToBeInitialzed = vehicles.map(function(vehicle) {
				return vehicle.mo_id;
			});
			$http({
				method: "GET",
				url: "/user/simulatedDriver",
				headers: {
					"If-Modified-Since": oldDate
				}
			}).success(function(drivers, status){
				var loc = $location.search()["loc"];
				vehicles.forEach(function(vehicle, i){
					$scope.vehicleStatus[vehicle.mo_id] = {busy: true, driving: false};

					var url = "../htmlclient/#/home" 
						+ "?vehicleId=" + vehicle.mo_id 
						+ "&driverId=" + drivers.data[0].driver_id; 
					if(vehicle.vendor){
						url += "&vendor=" + vehicle.vendor;
					}
					if(vehicle.serial_number){
						url += "&serial_number=" + vehicle.serial_number;
					}
					if(loc){
						url += "&loc=" + loc;
					}
					vehicle.url = $sce.trustAsResourceUrl(url);
					vehicle.display = i === 0;		
				});

				$scope.vehicles = vehicles;

				// dynamic state
				if(vehicles.length > 0){
					for (i=0; i < vehicles.length; i++) {
						$stateProviderRef.state(vehicles[i].mo_id, {
							url: "/fleet.html#" + vehicles[i].mo_id,
							views: {
								'vehicle': {
									templateUrl: '/htmlclient/vehicle.html',
									persist: true
								}
							}
						});
					}

					$scope.pageLoaded = true;
					$scope.selectedIndex = 0;
					$state.go(vehicles[0].mo_id);
				}
			
			}).error(function(error, status){
				console.error("Cannot get simulated driver");
			});
		}).error(function(error, status){
			console.error("Cannot get simulated vehicles");
		});
		
		$scope.selectItem = function(index) {
			var vehicles = $scope.vehicles;	    	 
			vehicles.forEach(function(vehicle, i){
				vehicle.display = i == index;		
			});
			$scope.selectedIndex = index;
		};
	
		$scope.onStartAll = function() {
			if (!$scope.busy) {
				$scope.requestingStarting = true;
				_postMessageToVehicles("simulator-start-all");
			}
		};
		
		$scope.onStopAll = function() {
			if (!$scope.busy) {
				$scope.requestingStopping = true;
				_postMessageToVehicles("simulator-stop-all");
			}
		};
		
    }]);
