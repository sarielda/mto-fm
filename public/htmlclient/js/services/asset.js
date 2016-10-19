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
 * Service to manage asset ids
 */
angular.module('htmlClient')
.factory('assetService', function($q, $timeout, $http, settingsService, mobileClientService) {
	var isAnomymous = false;
	var match = location.search.match(/anonymous=(.*?)(&|$)/);
	if(match) {
		isAnomymous = decodeURIComponent(match[1]) === "true";
	}
	
    return {
		settings: null,
		
		/*
		* variables for simulator 
		*/
		vendor: undefined,
		serial_number: undefined,
		shared_driver: false,
		/*
		 * Methods to get/set settings
		 */
		getVehicleId: function() {
			var settings = this.getSettings();
			return settings.iotaStarterVehicleId;
		},
		
		setVehicleId: function(vehicleId){
			var settings = this.getSettings();
			if (vehicleId)
				settings.iotaStarterVehicleId = vehicleId;
			else
				delete settings.iotaStarterVehicleId;
			this.updateSettings(settings);
		},
		
		getDriverId: function(){
			var settings = this.getSettings();
			return settings.iotaStarterDriverId;
		},
		
		setDriverId: function(driverId){
			var settings = this.getSettings();
			if (driverId)
				settings.iotaStarterDriverId = driverId;
			else
				delete settings.iotaStarterDriverId;
			this.updateSettings(settings);
		},
		
		isAutoManagedAsset: function(){
			if (this.isAnonymousAsset())
				return false;
			var settings = this.getSettings();
			return settings.isAutoManagedAsset;
		},
		
		setAutoManagedAsset: function(isAutoManagedAsset) {
			var settings = this.getSettings();
			if (isAutoManagedAsset)
				settings.isAutoManagedAsset = isAutoManagedAsset;
			else
				delete settings.isAutoManagedAsset;
			this.updateSettings(settings);
		},
		
		isAnonymousAsset: function(){
			return isAnomymous;
		},
    	
    	generateIds: function() {
    		if (this.getVehicleId()) {
    			var confirmMsg = this.isAutoManagedAsset() ? 
    					"Vehicle ID and Driver ID already exist. Are you sure you want to override them?" : 
    					"IDs managed by the IoT Automotive service already exist. Are you sure you want to override them?";
    			if (!confirm(confirmMsg))
    				return false;
    		}
    		this.setVehicleId(mobileClientService.uuid());
    		this.setDriverId(mobileClientService.uuid());
    		this.setAutoManagedAsset(false);
    		return true;
    	},
    	
    	clearIds: function() {
    		if (this.getVehicleId()) {
    			if (!confirm("Vehicle ID and Driver ID already exist. Are you sure you want to clear them?"))
    				return false;
    		}
    		this.setVehicleId();
    		this.setDriverId();
    		this.setAutoManagedAsset(false);
    		return true;
    	},
		
		getSettings: function() {
			if (this.settings)
				return this.settings;
			this.settings = settingsService.loadSettings("assetService", {});
			return this.settings;
		},
		
		updateSettings: function(settings) {
			if (this.settings.iotaStarterVehicleId !== settings.iotaStarterVehicleId || this.settings.iotaStarterDriverId !== settings.iotaStarterDriverId) {
	    		settings.isAutoManagedAsset = false;
			}
			this.settings = settings;
			settingsService.saveSettings("assetService", settings);
		},

    	/*
    	 * Methods to access asset services
    	 */
	    prepareAssets: function() {
			var vehicleId = this.getVehicleId();
			var driverId = this.getDriverId();

			var self = this;
	    	var promise = [];
			if(!vehicleId){
				promise.push($q.when(this.addVehicle(), function(vehicle){
					self.setVehicleId(vehicle.id);
					self.setAutoManagedAsset(true);
				}));
			}else if (this.isAutoManagedAsset()) {
				promise.push($q.when(this.getVehicle(vehicleId), function(vehicle){
					if(vehicleId !== vehicle.mo_id){
						self.setVehicleId(vehicle.mo_id);
					}
				}, function(err){
					// try to add vehicle
					return $q.when(self.addVehicle(), function(vehicle){
						self.setVehicleId(vehicle.id);
					});
				}));
			}

			//FIXME Get car probe requires driver_id as of 20160731
			if(!driverId){
				promise.push($q.when(this.addDriver(), function(driver){
					self.setDriverId(driver.id);
				}));
			}else if (this.isAutoManagedAsset()) {
				promise.push($q.when(this.getDriver(driverId), function(driver){
					if(driverId !== driver.driver_id){
						self.setDriverId(driver.driver_id);
					}
				}, function(err){
					// try to add vehicle
					return $q.when(self.addDriver(), function(driver){
						self.setDriverId(driver.id);
					});
				}));
			}
			
			return $q.all(promise).then(function(){
				return {vehicleId: self.getVehicleId(), driverId: self.getDriverId()};
			});
	    },
	    
	    activateAssets: function(toActivate) {
	    	var deferred = $q.defer();
			if (this.isAutoManagedAsset()) {
				var self = this;
				$q.when(self.activateVehicle(toActivate), function(vehicle){
					$q.when(self.activateDriver(toActivate), function(driver){
						// send car probe data now
						deferred.resolve();
					}, function(error){
						deferred.reject(error);
					});
				}, function(error){
					deferred.reject(error);
				});
			} else {
				// send car probe data now
				deferred.resolve();
			}
			return deferred.promise;
	    },

		getVehicle: function(mo_id){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method : 'GET',
				url : '/user/vehicle/' + mo_id
			})).success(function(data, status) {
				deferred.resolve(data);
			}).error(function(error, status) {
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		addVehicle: function(){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "POST",
				url: "/user/vehicle",
				headers: {
					'Content-Type': 'application/JSON;charset=utf-8'
				}
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		activateVehicle: function(toActive){
			var deferred = $q.defer();
			var mo_id = this.getVehicleId();
			$http(mobileClientService.makeRequestOption({
				method: "PUT",
				url: "/user/vehicle/" + mo_id + "?addition=true",
				headers: {
					"Content-Type": "application/JSON;charset=utf-8"
				},
				data: {mo_id: mo_id, serial_number: this.serial_number, vendor: this.vendor, status: toActive ? "active" : "inactive"}
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		deleteVehicle: function(mo_id){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "DELETE",
				url: "/user/vehicle/" + mo_id
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},

		getDriver: function(driver_id){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method : 'GET',
				url : '/user/driver/' + driver_id
			})).success(function(data, status) {
				deferred.resolve(data);
			}).error(function(error, status) {
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		addDriver: function(){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "POST",
				url: "/user/driver",
				headers: {
					'Content-Type': 'application/JSON;charset=utf-8'
				}
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		activateDriver: function(toActive){
			if (!toActive && this.shared_driver) {
				return;
			}
			var deferred = $q.defer();
			var driver_id = this.getDriverId();
			$http(mobileClientService.makeRequestOption({
				method: "PUT",
				url: "/user/driver/" + driver_id + "?addition=true",
				headers: {
					"Content-Type": "application/JSON;charset=utf-8"
				},
				data: {driver_id: driver_id, status: toActive ? "active" : "inactive"}
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		},
		
		deleteDriver: function(driver_id){
			var deferred = $q.defer();
			$http(mobileClientService.makeRequestOption({
				method: "DELETE",
				url: "/user/driver/" + driver_id
			})).success(function(data, status){
				deferred.resolve(data);
			}).error(function(error, status){
				deferred.reject({error: error, status: status});
			});
			return deferred.promise;
		}
	};
})
;