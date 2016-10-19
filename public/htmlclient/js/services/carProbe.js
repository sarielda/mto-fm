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
 * Service to create and publish car probe data
 */
angular.module('htmlClient')
.factory('carProbeService', function($q, $timeout, $http, $location, mobileClientService, messageClientService, settingsService, virtualGeoLocation) {
	var service = {
    	watchGeoHandle: null,
    	dirty: false,
    	deviceLocation: null,
    	driveEvent: null,
    	deviceId: null,	// set by setting UI (IoTP)
    	vehicleId: null,// get from service (IoT4A)
    	driverId: null,	// get from service (IoT4A) 
    	
    	vehicleData: {}, // for simulation

    	connectionStateDef: {
        	CONNECTION_STATE_DISCONNECTED: 0,
        	CONNECTION_STATE_CONNECTING: 1,
        	CONNECTION_STATE_CONNECTED: 2,
    	},
    	connectionState: 0,
    	onConnectionStateChanged: null,

    	settings: settingsService.loadSettings("carProbeService", {
			deviceId: null,
			connectOnStartup: true,
			simulation: true,
			idleMsgInterval: 3000,
			drivingMsgInterval: 1000
		}),
    	dataPublishHandle: null,
    	publishInterval: 0,
    	messageEventCallback: null,
    	
    	geolocation: null,
    	
    	// start monitoring probe data
	    startup: function() {
	        this.deviceLocation = {};
	        this.driveEvent = {};
	        this.dirty = false;
	        this.geolocation = this.settings.simulation ? virtualGeoLocation : navigator.geolocation;

	        this.changeConnectionState(this.connectionStateDef.CONNECTION_STATE_DISCONNECTED);

	        if(!this.settings.simulation){
	        	// in simulation case, we should start watching geo location at start driving
	        	this._startWatchLocation();
	        }
        },
        
        _stopWatchLocation: function(){
	        if (this.geolocation) {
	        	if (this.watchGeoHandle) {
	        		this.geolocation.clearWatch(this.watchGeoHandle);
	        		this.watchGeoHandle = null;
	        	}
	        }
        },
        
        _startWatchLocation: function(){
	        // Start watching geo location
	        if (this.geolocation) {
	        	this._stopWatchLocation();
	        	var self = this;
	        	this.watchGeoHandle = this.geolocation.watchPosition(function(position) {
			        if (!isNaN(position.coords.latitude)) {
			        	self.deviceLocation.lat = Math.round(position.coords.latitude * 10000000) / 10000000;
		        		self.dirty = true;
			        }
			        if (!isNaN(position.coords.longitude)) {
			        	self.deviceLocation.lng = Math.round(position.coords.longitude * 10000000) / 10000000;
			        	self.dirty = true;
			        }
			        if (!isNaN(position.coords.altitude)) {
			        	self.deviceLocation.altitude = Math.round(position.coords.altitude * 10000000) / 10000000;
			        	self.dirty = true;
			        }
			        if (!isNaN(position.coords.speed)) {
			        	speed = position.coords.speed;
			        	speed = speed * 60 * 60 / 1000; // m/s -> km/h
			        	self.driveEvent.speed = Math.round(speed * 100) / 100 || 0;
			        	self.dirty = true;
			        }	
			        if (!isNaN(position.coords.heading)) {
			        	self.driveEvent.heading = Math.round(position.coords.heading * 100) / 100 || 0;
			        	self.dirty = true;
			        }
			        if (self.settings.simulation){
			        	if(self.vehicleData.fuel){
			        		self.driveEvent.fuel = self.vehicleData.fuel;
			        	}else{
				        	if(isNaN(self.driveEvent.fuel)){
				        		self.driveEvent.fuel = 50;
				        	}else{
				        		self.driveEvent.fuel = Math.round((self.driveEvent.fuel - 0.01) * 100) / 100;
				        		if(self.driveEvent.fuel <= 0) self.driveEvent.fuel = 50;
				        	}
				        }
			        	if(self.vehicleData.engineTemp){
			        		self.driveEvent.engineTemp = self.vehicleData.engineTemp;
			        	}else{
			        		if(isNaN(self.driveEvent.engineTemp) || self.driveEvent.engineTemp > 130) self.driveEvent.engineTemp = 80;
			        		self.driveEvent.engineTemp = Math.round((Number(self.driveEvent.engineTemp)+(Math.random()*0.5-0.15))*100)/100;
				        }
			        }
	        	}, function() {
	        	}, {
	    			enableHighAccuracy: true,
	    			timeout: 5000,
	    			maximumAge: 100
	    		});
	        }
        },
        
        /*
         * Get car probe data. return cache if there is data already taken. Otherwise, get current data
         */
        getProbeData: function(force) {
	    	var deferred = $q.defer();
	    	if (!force && this.settings.simulation) {
	    		virtualGeoLocation.getCurrentPosition(function(location) {
	    			var probe = {
			        	deviceLocation: {
			        		lat: location.coords.latitude,
			        		lng: location.coords.longitude,
			        	},
			        	driveEvent: {
			        		speed: location.coords.speed,
			        		heading: location.coords.heading
			        	}
				    };
			        deferred.resolve(probe);
	    		});
	    	} else if (!force && !isNaN(this.deviceLocation.lat) && !isNaN(this.deviceLocation.lng)) {
        		var probe = {deviceLocation: this.deviceLocation, driveEvent: this.driveEvent};
		        deferred.resolve(probe);
	    	} else if (this.geolocation) {
        		var probe = {deviceLocation: this.deviceLocation, driveEvent: this.driveEvent};
	        	this.geolocation.getCurrentPosition(function(position) {
			        if (!isNaN(position.coords.latitude)) {
			        	probe.deviceLocation.lat = Math.round(position.coords.latitude * 10000000) / 10000000;
			        }
			        if (!isNaN(position.coords.longitude)) {
			        	probe.deviceLocation.lng = Math.round(position.coords.longitude * 10000000) / 10000000;
			        }
			        if (!isNaN(position.coords.altitude)) {
			        	probe.deviceLocation.altitude = Math.round(position.coords.altitude * 10000000) / 10000000;
			        }
			        if (!isNaN(position.coords.speed)) {
			        	speed = position.coords.speed;
			        	speed = speed * 60 * 60 / 1000; // m/s -> km/h
			        	probe.driveEvent.speed = Math.round(speed * 100) / 100 || 0;
			        }	
			        if (!isNaN(position.coords.heading)) {
			        	probe.driveEvent.heading = Math.round(position.coords.heading * 100) / 100 || 0;
			        }
			        deferred.resolve(probe);
	        	}, function(err) {
			        deferred.reject();
	        	}, {
	    			enableHighAccuracy: true,
	    			timeout: 5000,
	    			maximumAge: 100
	    		}) ;
        	}
			return deferred.promise;
        },
        
        // connect to service
    	connect: function(assets) {
    		if (this.getConnectionState() !== this.connectionStateDef.CONNECTION_STATE_DISCONNECTED) {
    			return;
    		}

			if (assets) {
	    		this.vehicleId = assets.vehicleId;
	    		this.driverId = assets.driverId;
			}
   			this.connectDevice();
    	},
	    
    	// disconnect from service
	    disconnect: function() {
	    	this.messageEventCallback = null;
	    	var deferred = $q.defer();
    		if (this.driveEvent.trip_id) {
            	deferred.reject("Stop driving before disconnecting.");
            	return;
    		}

    		if (this.dataPublishHandle) {
	        	clearInterval(this.dataPublishHandle);
	        	this.dataPublishHandle = null;
	        	this.publishInterval = 0;
	        }
    		
    		var self = this;
	        messageClientService.disconnect().then(function() {
		    	self.changeConnectionState(self.connectionStateDef.CONNECTION_STATE_DISCONNECTED);
		    	deferred.resolve(self.connectionStateDef.CONNECTION_STATE_DISCONNECTED);
	        }, function(err) {
		    	deferred.reject(err);
	        });
			return deferred.promise;
	    },
	    
	    connectDevice: function(){
	    	if (!messageClientService.isValid()) 
	    		return;

	    	this.changeConnectionState(this.connectionStateDef.CONNECTION_STATE_CONNECTING);
	    	console.log("Connecting device to IoT Foundation...");
	    	var self = this;
	    	messageClientService.connect(this.vehicleId).then(function() {
		    	// The device connected successfully
		    	console.log("Connected Successfully!");
		    	self.changeConnectionState(self.connectionStateDef.CONNECTION_STATE_CONNECTED);
		    	self.setDataPublishInterval(self.driveEvent.trip_id ?  self.settings.drivingMsgInterval : self.settings.idleMsgInterval);
	    	}, function(err) {
		    	// The device failed to connect. Let's try again in one second.
		    	console.log("Could not connect to IoT Foundation! Trying again in one second.");
		    	$timeout(self.connectDevice, 1000);
	    	});
	    },
	    
    	changeConnectionState: function(newState) {
	    	if (this.connectionState !== newState) {
		    	this.connectionState = newState;
	    		this.onConnectionStateChanged && this.onConnectionStateChanged(newState);
	    	}
    	},
    	
    	getConnectionState: function() {
    		return this.connectionState;
    	},
    	
	    setConnectionStateChangedListener: function(onConnectionStateChanged) {
	    	this.onConnectionStateChanged = onConnectionStateChanged;
	    },
        
        publish: function() {
			// We only attempt to publish if we're actually connected, saving CPU and battery
			if (this.connectionState !== this.connectionStateDef.CONNECTION_STATE_CONNECTED)
				return;
			// Publish only during driving in this app.
			if (!this.driveEvent.trip_id){
				return;
			}

			try {
				var data = {
					ts: Date.now(),
					lat: this.deviceLocation.lat,
					lng: this.deviceLocation.lng,
					altitude: this.deviceLocation.altitude,
					mo_id: this.vehicleId,
					driver_id: this.driverId,
					props: {}
				};
		
				// Send speed and heading data while driving
				if (this.driveEvent.trip_id != null) {
					data.trip_id = this.driveEvent.trip_id;
					data.speed = this.driveEvent.speed||0;
					if (this.driveEvent.heading != null)
						data.heading = this.driveEvent.heading;
					if (this.driveEvent.fuel != null)
						data.props.fuel = this.driveEvent.fuel;
					if (this.driveEvent.engineTemp != null)
						data.props.engineTemp = this.driveEvent.engineTemp;
				} 
				var self = this;
				messageClientService.publish(data).then(function(matchedData) {
					this.matchedData = matchedData;
	        		this.messageEventCallback && this.messageEventCallback(this.matchedData);
	            	this.dirty = true;
				}.bind(this));
			} catch (err) {
		        this.changeConnectionState(this.connectionStateDef.CONNECTION_STATE_DISCONNECTED);
		    	
		        var self = this;
	        	// reconnect
	        	$timeout(function() {
	        		self.connectDevice();
	        	}, 1000); 
			}
	    },
	    
	    setDataPublishInterval: function(interval) {
	    	if (this.publishInterval === interval)
	    		return;

	    	this.publishInterval = interval || this.settings.idleMsgInterval;
	    	if (this.dataPublishHandle) {
	        	clearInterval(this.dataPublishHandle);
	        	this.dataPublishHandle = null;
	        }
	        var self = this;
	        this.dataPublishHandle = setInterval(function() {
	        	self.publish();
	        }, this.publishInterval);
	    },

	    makeTrip: function(messageEventCallback) {
	    	if(this.settings.simulation){
	    		this._startWatchLocation();
	    	}
	    	this.messageEventCallback = messageEventCallback;
	    	this.driveEvent.trip_id = mobileClientService.uuid();
	    	this.setDataPublishInterval(this.settings.drivingMsgInterval);
	    	return this.driveEvent.trip_id;
	    },
	    
	    clearTrip: function() {
	    	if(this.settings.simulation){
	    		this._stopWatchLocation();
	    	}
	    	this.messageEventCallback = null;
	    	this.driveEvent.trip_id = null;
            this.setDataPublishInterval(this.settings.idleMsgInterval);
            return null;
	    },
	    
	    hasTripId: function() {
	    	return this.driveEvent.trip_id;
	    },
	    
	    updateData: function(data, force) {
	    	if (!force && !this.dirty) {
	    		return false;
	    	}
	    	this.dirty = false;
	    	for (var key in data) {
		    	data[key] = this[key];
	    	}
	    	return true;
	    },
		
		getSettings: function() {
			return this.settings;
		},
		
		updateSettings: function(settings) {
			this.settings = settings;
			settingsService.saveSettings("carProbeService", settings, 30);
            this.setDataPublishInterval(this.driveEvent.trip_id ?  this.settings.drivingMsgInterval : this.settings.idleMsgInterval);
            if(this.settings.simulation){
            	if(this.geolocation != virtualGeoLocation){
            		this._stopWatchLocation();
            		this.geolocation = virtualGeoLocation;
            		// in simulation case, start watching location when start driving
				}
            }else{
            	if(this.geolocation != navigator.geolocation){
            		this._stopWatchLocation();
            		this.geolocation = navigator.geolocation;
            		this._startWatchLocation();
				}
            }
		},
		
		setVehicleData: function(vehicleData){
			this.vehicleData = vehicleData;
		}

    };
    
    service.startup();
    return service;
})
;