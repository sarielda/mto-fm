/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
(function(scriptBaseUrl){
	angular.module('htmlClient').
	component('clientDrive', {
		templateUrl: scriptBaseUrl + 'html-client-drive.html',
		controller: function ClientTop($scope, $http ,$q, assetService, carProbeService, eventService, geofenceService, virtualGeoLocation, $window, $timeout) {
			$window.onbeforeunload = function (e) {
				// inactivate when user closes simulator window
				assetService.activateAssets(false);
			};
			
			// inter frame communication to recieve start/stop all and return status
			function postStatusMessage(target, requestMessage, requestId, isError) {
				target = target || $scope.messageTarget;
				if (!target) {
					return;
				}
				var vehicleId = assetService.getVehicleId();
				var driving = carProbeService.hasTripId();
				var busy = $scope.requestSending;
				
				var messageObj = {message: "status", mo_id: vehicleId, driving: driving, busy: busy, requestMessage: requestMessage, requestId: requestId, isError: isError};
				target.postMessage(JSON.stringify(messageObj), "*");
			}
			
	        $($window).on('message', function(e) {
	        	if ($window.location.origin !== e.originalEvent.origin, 0) {
	        		return;
	        	}
	        	var message = JSON.parse(e.originalEvent.data);
	        	if (message.message === "simulator-start-all" || message.message === "simulator-stop-all") {
	        		$q.when($scope.onDriving(true, message.message === "simulator-start-all"), function() {
	        			postStatusMessage(e.originalEvent.source, message.message, message.requestId);
	        		}, function(error) {
	        			postStatusMessage(e.originalEvent.source, message.message, message.requestId, true);
	        		});
	        	} else if (message.message === "simulator-set-message-target") {
	        		$scope.messageTarget = e.originalEvent.source;
        			postStatusMessage(e.originalEvent.source, message.message, message.requestId);
	        	}
	        });
	        
			$scope.drivingButtonLabel = "Start Driving";
			var updateUIHandle = null;
			// start driving
			function startDriving() {
				var self = this;
				return $q.when(assetService.prepareAssets(), function(assets) {
			    	var promise = [];
			    	promise.push($q.when(assetService.activateAssets(true), function() {
			    		return;
					}));
			    	promise.push($q.when(carProbeService.connect(assets), function() {
			    		return;
					}));
					return $q.all(promise).then(function(){
						var tripId = carProbeService.makeTrip(function(probe) {
							if (self.requiredEvents > 0) {
								self.requiredEvents--;
							}
							updateVehicle(probe, probe.notification);
						});
						return tripId;
					});
				});
			}
			
			// stop driving
			function stopDriving() {
				carProbeService.clearTrip();
				updateVehicle();
				return $q.when(assetService.activateAssets(false), function() {
					return null;
				});
			}
			
			function connectionStateListner(state) {
        		if (state === carProbeService.connectionStateDef.CONNECTION_STATE_DISCONNECTED) {
	            	$scope.isConnected = false;
	            	$scope.connecting = false;
        		} else if (state === carProbeService.connectionStateDef.CONNECTION_STATE_CONNECTING) {
	            	$scope.isConnected = false;
	            	$scope.connecting = true;
        		} else {
	            	$scope.isConnected = true;
	            	$scope.connecting = false;
        		}
        	}

			//////////////////////////////////////////////////////////////////
			// UI handlers
			//////////////////////////////////////////////////////////////////

			// Connect/Disconnect button
		    $scope.onConnect = function() {
		    	if (carProbeService.getConnectionState() === carProbeService.connectionStateDef.CONNECTION_STATE_DISCONNECTED) {
		            carProbeService.connect();
		    	} else if (carProbeService.getConnectionState() === carProbeService.connectionStateDef.CONNECTION_STATE_CONNECTED) {
		    		carProbeService.disconnect();
		    	}
		    };
		    
		    // Start/Stop driving button
		    $scope.onDriving = function(force, drive) {
		    	var deferred = $q.defer();
		    	if ($scope.requestSending) {
		    		deferred.reject("function is busy");
		    	} else if (carProbeService.hasTripId() && (!force || !drive)) {
					$scope.drivingButtonLabel = "Stopping Driving";
					$scope.requestSending = true;
					!force && postStatusMessage();
					stopDriving().then(function() {
						$scope.driveEvent.trip_id = null;
						$scope.drivingButtonLabel = "Start Driving";
						$scope.requestSending = false;
						deferred.resolve(true);
						!force && postStatusMessage();
					}, function(err) {
						alert((err.data && err.data.message) || err.responseText || err.message || err);
						$scope.drivingButtonLabel = "Stop Driving";
						$scope.requestSending = false;
						deferred.reject(err);
						!force && postStatusMessage();
					});
				} else if (!carProbeService.hasTripId() && (!force || drive)) {
					// clean route dots
					routeLayer.getSource().clear();
					$scope.drivingButtonLabel = "Preparing Driving";
					$scope.requestSending = true;
					!force && postStatusMessage();
					startDriving().then(function(tripId) {
						$scope.drivingButtonLabel = "Stop Driving";
						$scope.requestSending = false;
						$scope.driveEvent.trip_id = tripId;
						deferred.resolve(true);
						!force && postStatusMessage();
					}, function(err) {
						alert((err.data && err.data.message) || err.responseText || err.message || err);
						$scope.drivingButtonLabel = "Start Driving";
						$scope.requestSending = false;
						deferred.reject(err);
						!force && postStatusMessage();
					});
				} else {
					deferred.resolve(false);
				}
		    	return deferred.promise;
		    };
		    
		    var vehicleData = {};
		    $scope.updateVehicleDataName = function(){
				var value = vehicleData[$scope.vehicleDataName];
				if(value){
					$scope.vehicleDataValue = $scope.vehicleDataName === "engineTemp" ? String(value*9/5 + 32) : value;
				}else{
					$scope.vehicleDataValue = "";
				}
		    };
		    $scope.updateVehicleDataValue = function(){
		    	if($scope.vehicleDataName){
					var value = $scope.vehicleDataValue;
					if(value){
						vehicleData[$scope.vehicleDataName] = $scope.vehicleDataName === "engineTemp" ? String((value-32)*5/9) : value;
					}else{
		    		vehicleData[$scope.vehicleDataName] = value;
					}
			    	carProbeService.setVehicleData(vehicleData);
			    }
		    };
		    $scope.updateVehicleData = function(){
		    	carProbeService.setVehicleData({
		    		fuel: $scope.fuel,
		    		engineTemp: $scope.engineTemp
		    	});
		    };
		
		    $scope.onChangeSrcDirection = function() {
				var loc = virtualGeoLocation.getCurrentPosition(function(loc) {
					var coords = loc.coords;
					if (!coords) {
						return;
					}
					virtualGeoLocation.setCurrentPosition({lat: coords.latitude, lon: coords.longitude, heading: $scope.srcDirection}).then(function(tripRoute){
						_plotTripRoute(tripRoute);
					});
				});
		    };
			
		    $scope.onChangeDstDirection = function() {
		    	var destination = virtualGeoLocation.getDestination();
		    	if (!destination) {
		    		return;
		    	}
				virtualGeoLocation.setDestinationPosition({lat: destination.lat, lon: destination.lon, heading: $scope.dstDirection}).then(function(tripRoute){
					_plotTripRoute(tripRoute);
				});
		    };
		    
		    $scope.onAvoidEventChange = function() {
		    	virtualGeoLocation.setOption("avoid_events", $scope.opt_avoid_events);
		    	virtualGeoLocation.updateRoute().then(function(tripRoute) {
					_plotTripRoute(tripRoute);
		    	});
		    };
		    
		    $scope.onRouteLoop = function() {
		    	virtualGeoLocation.setOption("route_loop", $scope.opt_route_loop);
		    	virtualGeoLocation.updateRoute().then(function(tripRoute) {
					_plotTripRoute(tripRoute);
		    	});
		    };
		    
	        // device ID
		    $scope.connectOnStartup = carProbeService.getSettings().connectOnStartup;
			$scope.simulation = carProbeService.settings.simulation;
		    
		    $scope.traceCurrentLocation = true;

        	$scope.isConnected = false;
        	$scope.connecting = false;
	        $scope.deviceLocation = {};
	        $scope.driveEvent = {};
			$scope.directions = [{label: "North", value: 0}, {label: "North East", value: 45}, {label: "East", value: 90}, {label: "South East", value: 135},
				                      {label: "South", value: 180}, {label: "South West", value: 225}, {label: "West", value: 270}, {label: "North West", value: 315}];
			$scope.srcDirection = 0;
			$scope.dstDirection = 0;
	        $scope.actionMode = "action-car-position";
	        $scope.opt_avoid_events = virtualGeoLocation.getOption("avoid_events");
	        $scope.opt_route_loop = virtualGeoLocation.getOption("route_loop");

			// rules
			// should be synced with rules defined in /driverinsights/fleetalert.js
			$scope.rules = [
				{propName: "engineTemp", label: "Engine Temperature (Critical if larger than 248)"},
				{propName: "fuel", label: "Fuel"}
			];
			assetService.getVehicle(assetService.getVehicleId()).then(function(vehicle){
				var tank = vehicle.properties.fuelTank;
				if(tank){
					$scope.rules[1].label = "Fuel (Troubled if smaller than " + tank/2 + ", Critical if smaller than " + tank/10 + ")";
				}
			});
			
			// vehicle data control panel
			$scope.fuel = null;
			$scope.engineTemp = null;
			
			//
			// Compose Map component
			//
			var map = null;
			var carFeature = null;
			var destFeature = null;
			var carsLayer = null;
			var eventLayer = null;
			var geofenceLayer = null;
	    	var routeLayer = null;
	    	var tripLayer = null;
	    	var routeStyle = null;
	    	var matchedRouteStyle = null;
			var DEFAULT_ZOOM = 16;
			
			var mapHelper = null;
			var eventHelper = null;
			var geofenceHelper = null;

			// How the app can determin if a map is panned by the app or by a user. Need to find a smarter way
			var lockPosition = false;
		    
		    // Show current location on a map
		    $scope.onCurrentLocation = function() {
        		carProbeService.getProbeData().then(function(data) {
        			lockPosition = true;
    				$scope.traceCurrentLocation = true;
    				showLocation(data.deviceLocation);
       		}, function(err) {});
		    };

		    // Show current location on a map
		    $scope.showControlPanel = function() {
   				$scope.isControlPanelDisplayed = !$scope.isControlPanelDisplayed; 
		    };

			// Show specified location on a map
			function showLocation(location) {
				if (!map) return;
				var view = map.getView();
				view.setRotation(0);
				view.setCenter(ol.proj.fromLonLat([location.lng||0, location.lat||0]));
				view.setZoom(DEFAULT_ZOOM);
			}

			// Update UI when car probe date is changed
			// add start/end icon
			function plotRoute(position, style, route){
				if(!routeLayer){
					return;
				}
				var feature = new ol.Feature({
					geometry: new ol.geom.Point(position),
					route : route
				});
				feature.setStyle(style);
				routeLayer.getSource().addFeature(feature);
			}
			
			function updateVehicle(probe, notification) {
				// affected events
				var affectedEvents = (notification && notification.affected_events) || [];
				affectedEvents.forEach(function(event) {
					console.log("affected event = " + event.event_id);
				});
				eventHelper.updateAffectedEvents(affectedEvents);
				
				// notifed messages
				var notifiedMessages = (notification && notification.notified_messages) || [];
				notifiedMessages.forEach(function(message) {
					console.log("notified message = " + message.message);
				});
			}
	    	
	    	function addStoppingPoint(location){
	    		if(!destFeature){
					destFeature = new ol.Feature({geometry:new ol.geom.Point(location)});	
					var destStyle = new ol.style.Style({
						image: new ol.style.Circle({
							radius:8,
							fill : new ol.style.Fill({
								color: 'rgba(255, 0, 0, 0.7)'
							})
						})
					});
					destFeature.setStyle(destStyle);
					carsLayer.getSource().addFeature(destFeature);
				}
				
				destFeature.getGeometry().setCoordinates(location);
	    	}
	    	
	    	function setDestination(location){
	    		if(!destFeature){
					destFeature = new ol.Feature({geometry:new ol.geom.Point(location)});	
					var destStyle = new ol.style.Style({
						image: new ol.style.Circle({
							radius:8,
							fill : new ol.style.Fill({
								color: 'rgba(255, 0, 0, 0.7)'
							})
						})
					});
					destFeature.setStyle(destStyle);
					carsLayer.getSource().addFeature(destFeature);
				}
				
				destFeature.getGeometry().setCoordinates(location);
	    	}
			
			function updateUI(force) {
	        	var data = {
			        	deviceLocation: {},
			        	driveEvent: {},
			        	matchedData: {}
		        	};
		        if (carProbeService.updateData(data, force)) {
		        	for (var key in data) {
		        		$scope[key] = data[key];
		        	}
		        	
	        		if (carFeature && data.deviceLocation) {
	        			var loc = [data.deviceLocation.lng||0, data.deviceLocation.lat||0];
	    				var newPosition = ol.proj.fromLonLat(loc);
		        		carFeature.getGeometry().setCoordinates(newPosition);
	        			plotRoute(newPosition, routeStyle);
	        		}
	        		if ($scope.traceCurrentLocation) {
	        			lockPosition = true;
		        		showLocation(data.deviceLocation);
	        		}
	        		if(data.matchedData && carProbeService.hasTripId()){
	        			var loc = [data.matchedData.matched_longitude||0, data.matchedData.matched_latitude||0];
	    				var matchedPosition = ol.proj.fromLonLat(loc);
	        			plotRoute(matchedPosition, matchedRouteStyle, data.matchedData);
	        		}
		        }
		        return false;
        	}

	    	// Start handling move event 
			function enableMoveListener() {
				map.on('pointerdrag', function() {
					// if map is moved by user, disable traceCurrentLocation flag so as not to show car location automatically
					if ($scope.traceCurrentLocation) {
						$scope.traceCurrentLocation = false;
		        		$scope.$apply();
					}
				});
				map.on("moveend", function(e){
					if ($scope.traceCurrentLocation && !lockPosition) {
						$scope.traceCurrentLocation = false;
		        		$scope.$apply();
					}
					lockPosition = false;
				});
				map.on("click", function(e){
					if(!carProbeService.hasTripId() && carProbeService.settings.simulation){
						var loc = ol.proj.toLonLat(e.coordinate);
						if ($scope.actionMode === "action-car-position") {
							virtualGeoLocation.setCurrentPosition({lat: loc[1], lon: loc[0], heading: $scope.srcDirection}).then(function(tripRoute){
								_plotTripRoute(tripRoute);
							});
							carFeature.getGeometry().setCoordinates(e.coordinate);
						} else if ($scope.actionMode === "action-route") {
							virtualGeoLocation.setDestinationPosition({lat: loc[1], lon: loc[0], heading: $scope.dstDirection}).then(function(tripRoute){
								_plotTripRoute(tripRoute);
							});
							setDestination(e.coordinate);
						}
					}
				});
			}

			function _plotTripRoute(tripRoute){
				if(!tripLayer){
					return;
				}
				tripLayer.getSource().clear();
				var lines = [];
				for (i=0; i<(tripRoute.length-1); i++) {
					lines.push([ol.proj.fromLonLat([tripRoute[i].lon, tripRoute[i].lat]), 
								ol.proj.fromLonLat([tripRoute[i+1].lon, tripRoute[i+1].lat])]);
				}
				var lineStrings = new ol.geom.MultiLineString([]);
				lineStrings.setCoordinates(lines);
				var feature = new ol.Feature(lineStrings);
				tripLayer.getSource().addFeature( feature );
			}
			
	    	// start monitoring car probe date
	    	function startPositionMonitoring(interval) {
	    		stopPositionMonitoring();
	        	updateUIHandle = setInterval(function() {
		        	if (updateUI()) {
		        		$scope.$apply();
		        	}
	        	}, interval||1000);
	    	}

	    	// stop monitoring car probe date
	    	function stopPositionMonitoring() {
	        	if (updateUIHandle) {
	        		clearInterval(updateUIHandle);
	        		updateUIHandle = null;
	        	}
	    	}
	    	
	    	function setDestination(location){
	    		if(!destFeature){
					destFeature = new ol.Feature({geometry:new ol.geom.Point(location)});	
					var destStyle = new ol.style.Style({
						image: new ol.style.Circle({
							radius:8,
							fill : new ol.style.Fill({
								color: 'rgba(255, 0, 0, 0.7)'
							})
						})
					});
					destFeature.setStyle(destStyle);
					carsLayer.getSource().addFeature(destFeature);
				}
				
				destFeature.getGeometry().setCoordinates(location);
	    	}
			
		    // Initialize a map
			var initMap = function initMap(location){
				var centerPosition = ol.proj.fromLonLat([location.lng||0, location.lat||0]);
    			lockPosition = true;
				
				// Setup current car position
				carFeature = new ol.Feature({geometry: new ol.geom.Point(centerPosition)});
				var carStyle = new ol.style.Style({
					image: new ol.style.Icon({
						anchor: [0.5, 0.5],
						anchorXUnits: 'fraction',
						anchorYUnits: 'fraction',
						src: 'images/car.png'
					})
				});
				carsLayer = new ol.layer.Vector({source: new ol.source.Vector({features: [carFeature]}), style: carStyle});	

				// create route layer
				routeStyle = new ol.style.Style({
					image: new ol.style.Circle({
						radius:3,
						stroke: new ol.style.Stroke({
							color: 'orange',
							width: 1
						}),
						fill : new ol.style.Fill({
							color: 'rgba(200, 0, 0, 0.7)'
						})
					})
				});
				
				matchedRouteStyle = new ol.style.Style({
					image: new ol.style.Circle({
						radius:3,
						stroke: new ol.style.Stroke({
							color: 'darkgreen',
							width: 1
						}),
						fill : new ol.style.Fill({
							color: 'rgba(0, 200, 0, 0.7)'
						})
					})
				});
				
				routeLayer = new ol.layer.Vector({
					source: new ol.source.Vector()
				});
				
				// trip layer
				var tripStyle = new ol.style.Style({
					stroke: new ol.style.Stroke({ color: 'rgba(120, 120, 120, 0.7)', width: 3 }),
				});
				tripLayer = new ol.layer.Vector({source: new ol.source.Vector(), style: tripStyle});	
				
				// event layer
				eventLayer = new ol.layer.Vector({
					source: new ol.source.Vector()
				});
				
				// geofence layer
				geofenceLayer = new ol.layer.Vector({
					source: new ol.source.Vector()
				});
				
				// create a map
				map =  new ol.Map({
					controls: ol.control.defaults({
						attributionOptions: /** @type {olx.control.AttributionOptions} */ ({
								collapsible: false
						})
					}),
					target: document.getElementById("locationMap"),
					layers: [
						new ol.layer.Tile({source: new ol.source.OSM({}), preload: 4}),  // map layer
						geofenceLayer,
						eventLayer,
						carsLayer,
						routeLayer,
						tripLayer
					],
					view: new ol.View({
						center: centerPosition,
						zoom: DEFAULT_ZOOM
					}),
				});
				
				eventHelper = new EventHelper(map, eventLayer, $q, eventService);
				geofenceHelper = new GeofenceHelper(map, geofenceLayer, $q, geofenceService);
				
				enableMoveListener();
				
				window.onresize = function() {
					$timeout( function() { 
	    				if ($scope.traceCurrentLocation) {
	    					lockPosition = true;
	    				}
						map.updateSize();
					}, 200);
				}

				//
				// Setup popover
				//
				mapHelper = new MapHelper(map);
				mapHelper.addPopOver({
						elm: document.getElementById('infopopup'),
						pin: false,
//						updateInterval: 1000,
					}, 
					function showPopOver(elem, feature, pinned, closeCallback){
						if(!feature) return;
						var content = getPopOverContent(feature);
						if(content){
							var title = '<div>' + (content.title ? _.escape(content.title) : '') + '</div>' + 
									(pinned ? '<div><span class="btn btn-default close">&times;</span></div>' : '');
							var pop = $(elem).popover({
								//placement: 'top',
								html: true,
								title: title,
								content: content.content
							});
							if(pinned){
								pop.on('shown.bs.popover', function(){
									var c = $(elem).parent().find('.popover .close');
									c.on('click', function(){
										closeCallback && closeCallback();
									});
								});
							}
							$(elem).popover('show');
						}
					}, 
					function destroyPopOver(elem, feature, pinned){
						if(!feature) return;
						$(elem).popover('destroy');
					}, 
					function updatePopOver(elem, feature, pinned){
						if(!feature) return;
						var content = getPopOverContent(feature);
						if(content){
							var popover = $(elem).data('bs.popover');
							if(popover.options.content != content.content){
								popover.options.content = content.content;
								$(elem).popover('show');
							}
						}
					});
				
				// popover - generate popover content from ol.Feature
				var getPopOverContent = function getPopOverContent(feature){
					var content = feature.get('popoverContent');
					if(content)
						return {content: '<span style="white-space: nowrap;">' + _.escape(content) + '</span>' };
					
					var item = feature.get('item');
					if(item){
						if (item.event_id)
							return eventHelper.createEventDescriptionHTML(item);
//						else if (item.geometry)
//							return geofenceHelper.createGeofenceDescriptionHTML(item);
					} else {
						var route = feature.get('route');
						if (route) {
							var result = { content: '', title: 'Route' };
							
							var lat = route.matched_latitude || route.latitude;
							var lon = route.matched_longitude || route.longitude;
							var heading = route.matched_heading || route.heading;
							var speed = route.speed;
							// location and heading
							var index = Math.floor(((heading/360 + 1/32) % 1) * 16);
							var dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
							var dir = dirs[index];
							result.content = '<table><tbody>' +
										'<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">LOCATION:</span></th><td style="white-space: nowrap">' + Math.round(lat * 10000000) / 10000000 + ',' + Math.round(lon * 10000000) / 10000000 + '</td></tr>' +
										'<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">HEADING:</span></th><td>' + Math.round(heading * 10000000) / 10000000 + ' [' + dir + ']' + '</td></td>' +
										'<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">SPEED:</span></th><td>' + Math.round(speed / 0.01609344) / 100 + 'MPH</td></tr>' +
										'<tbody><table>'
							return result;
						} else if (feature === carFeature) {
						} else if (feature === destFeature) {
							var destination = virtualGeoLocation.getDestination();
							if (destination) {
								var result = { content: '', title: 'Destination' };
								result.content = '<table><tbody>' +
											'<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">LOCATION:</span></th><td style="white-space: nowrap">' + Math.round(destination.lat * 10000000) / 10000000 + ',' + Math.round(destination.lon * 10000000) / 10000000 + '</td></tr>' +
											'<tbody><table>'
								return result;
							}
						}
					}
					return null;
				};
			
			};
	    	
			// initializer
			this.$onInit = function() {
	        	connectionStateListner(carProbeService.getConnectionState());
	        	carProbeService.setConnectionStateChangedListener(connectionStateListner);

        		carProbeService.getProbeData(true).then(function(data) {
        			// Show current location
					initMap(data.deviceLocation);
					if(carProbeService.settings.simulation){
						virtualGeoLocation.setCurrentPosition({lat: data.deviceLocation.lat, lon: data.deviceLocation.lng}).then(function(tripRoute){
							_plotTripRoute(tripRoute);
						});
//						$timeout($scope.onDriving, 3000); // automatically start driving after 3 seconds
					}
					
        		}, function(err) {
					initMap({lat: 0, lng: 0});
        		});
        		
        		updateUI(true);
	        	startPositionMonitoring();
			};
			
			this.$onDestroy = function() {
	        	stopPositionMonitoring();
			};
		}
	});

	/*
	 * Map helper
	 */
	var MapHelper = function(map){
		// the map
		this.map = map;
	}
	
	/**
	 * Add popover to the map
	 * @options
	 *     options.elm: (required) the popover DOM element, which is a child of the map base element
	 *     options.pin: true to enable "pin" capability on the popover. with it, the popover is pinned by
	 *                  clicking on a target feature
	 *     options.updateInterval: interval time in millisec for updating popover content
	 * @showPopOver a function called on showing popover: function(elm, feature, pinned)
	 * @destroyPopOver a function called on dismissing the popover: function(elm, feature, pinned)
	 *   where @elm is the `elm` given as the first parameter to this method,
	 *         @feature is ol.Feature, @pinned is boolean showing the "pin" state (true is pinned)
	 * @pdatePopOver a function called on updating popover content: function(elm, feature, pinned)
	 */
	MapHelper.prototype.addPopOver = function addPopOver(options, showPopOver, destroyPopOver, updatePopOver){
		// check and normalize arguments
		var elm = options.elm;
		if(!options.elm){
			console.error('Missing popup target element. Skipped to setup popover.');
		}
		var nop = function(){};
		showPopOver = showPopOver || nop;
		destroyPopOver = destroyPopOver || nop;
		
		// control variables
		var currentPopoverFeature;
		var currentPinned;
		var startUpdateTimer, stopUpdateTimer; // implemented in section below
		
		// create popover objects
		var overlay = new ol.Overlay({
			element: elm,
			offset: [2,-3],
			positioning: 'center-right',
			stopEvent: true
		});
		this.map.addOverlay(overlay);
		
		//
		// Implement mouse hover popover
		//
		this.map.on('pointermove', (function(event){
			// handle dragging
			if(event.dragging){
				if(currentPinned)
					return; // don't follow pointer when pinned
				
				stopUpdateTimer();
				destroyPopOver(elm, currentPopoverFeature);
				currentPopoverFeature = null;
				return;
			}
			
			var feature = this.map.forEachFeatureAtPixel(event.pixel, function(feature, layer){
				return feature;
			});
			this.map.getTargetElement().style.cursor = (feature ? 'pointer' : ''); // cursor
			
			// guard by pin state
			if(currentPinned)
				return; // don't follow pointer when pinned
			
			if(feature)
				overlay.setPosition(event.coordinate);
			
			if(currentPopoverFeature !== feature){
				stopUpdateTimer();
				destroyPopOver(elm, currentPopoverFeature);
				currentPopoverFeature = feature;
				showPopOver(elm, currentPopoverFeature);
				startUpdateTimer();
			}
			
		}).bind(this));
		
		//
		// Implement "pin" capability on the popover
		//
		if(options.pin){
			var trackGeometryListener = function(){
				var coord = currentPopoverFeature.getGeometry().getCoordinates();
				overlay.setPosition(coord);
			};
			var closePinnedPopover = (function closeFunc(){
				stopUpdateTimer();
				destroyPopOver(elm, currentPopoverFeature, currentPinned);
				if(currentPopoverFeature)
					currentPopoverFeature.un('change:geometry', trackGeometryListener);
				currentPinned = false;
			}).bind(this);
			var showPinnedPopover = (function showFunc(){
				currentPinned = true;
				showPopOver(elm, currentPopoverFeature, currentPinned, closePinnedPopover);
				startUpdateTimer();
				if(currentPopoverFeature)
					currentPopoverFeature.on('change:geometry', trackGeometryListener);
			}).bind(this);
			
			this.map.on('singleclick', (function(event){
				var feature = this.map.forEachFeatureAtPixel(event.pixel, function(feature, layer){
					return feature;
				});
				if(!feature) return; // pin feature only works on clicking on a feature
				
				if(!currentPinned && feature === currentPopoverFeature){
					// Pin currently shown popover
					closePinnedPopover();
					showPinnedPopover();
				}else if(!currentPinned && feature !== currentPopoverFeature){
					// Show pinned popover
					var coord = feature.getGeometry().getCoordinates();
					overlay.setPosition(coord);
					// show popover
					currentPopoverFeature = feature;
					showPinnedPopover();
				}else if(currentPinned && currentPopoverFeature !== feature){
					// Change pinned target feature
					closePinnedPopover();
					currentPopoverFeature = feature;
					// move
					var coord = feature.getGeometry().getCoordinates();
					overlay.setPosition(coord);
					// show
					showPinnedPopover();
				}else if(currentPinned && feature === currentPopoverFeature){
					// Remove pin
					closePinnedPopover();
					//currentPopoverFeature = null;
					//showPopOver(elm, currentPopoverFeature, pinned); // to clear
				}
			}).bind(this));
		}
		
		//
		// Implement periodical content update option
		//
		if(options.updateInterval && updatePopOver){
			var timer = 0;
			startUpdateTimer = function(){
				stopUpdateTimer();
				timer = setTimeout(callUpdate, options.updateInterval);
			};
			stopUpdateTimer = function(){
				if(timer){
					clearTimeout(timer);
					timer = 0;
				}
			};
			var callUpdate = function(){
				updatePopOver(elm, currentPopoverFeature, currentPinned);
				timer = setTimeout(callUpdate, options.updateInterval);
			};
		}else {
			startUpdateTimer = function(){}; // nop
			stopUpdateTimer = function(){}; // nop
		}
		
	};
	
	
	/*
	 * Event healer
	 */
	var EventHelper = function(map, layer, q, eventService){
		// the map
		this.map = map;
		this.eventLayer = layer;
		this.eventService = eventService;
		this.q = q;
		this.eventTypes = [];

		var self = this;
		this.eventLoadingHandle = null;
	    layer.setStyle(function(feature, resolution) {
		    var eventIcon = new ol.style.Circle({
		        radius: 10,
		        stroke : new ol.style.Stroke({
		          color: "#ffc000",
		          width: 1
		        }),
		        fill : new ol.style.Fill({
		          color: "yellow"
		        })
		      });
		    var affectedEventIcon = new ol.style.Circle({
		        radius: 10,
		        stroke : new ol.style.Stroke({
		          color: "yellow",
		          width: 3
		        }),
		        fill : new ol.style.Fill({
		          color: "#ffc000"
		        })
		      });
		    
		    var arrowTexts = ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"];
		    self.styles = arrowTexts.map(function(text) {
			    rotation = 0; // 3.14 * rotation / 180;
			    return new ol.style.Style({
			        image: eventIcon,
			        text: new ol.style.Text({
			            fill: new ol.style.Fill({color: "#606060"}),
			            scale: 1.0,
			            textAlign: "center",
			            textBaseline: "middle",
			            text: text,
			            rotation: rotation,
			            font: "16px monospace"
			        })
			      });
		    });
		    self.affectedStyles = arrowTexts.map(function(text) {
			    rotation = 0; // 3.14 * rotation / 180;
			    return new ol.style.Style({
			        image: affectedEventIcon,
			        text: new ol.style.Text({
			            fill: new ol.style.Fill({color: "#404040"}),
			            scale: 1.0,
			            textAlign: "center",
			            textBaseline: "middle",
			            text: text,
			            rotation: rotation,
			            font: "16px monospace"
			        })
			      });
		    });

		    return function(feature, resolution) {
		    	var style = self.getEventStyle(feature);
			    feature.setStyle(style);
			    return style;

		    };
	    }());

		this.eventListChangedListeners = [];
		this.eventMap = {};
		
	    this.map.getView().on('change:center', function() {
	    	self.viewChanged();
	    });
	    this.map.getView().on('change:resolution', function() {
	    	self.viewChanged();
	    });
		q.when(this.getEventTypes(), function(eventTypes) {
			self.eventTypes = eventTypes;
		});
		this.updateEvents();
	};

	EventHelper.prototype.getEventStyle = function getEventStyle(feature) {
    	var event = feature.get("item");
    	if (!event) {
    		return;
    	}
	    var textIndex = Math.floor((event.heading % 360) / Math.floor(360 / this.styles.length));
	    var rotation = (event.heading % 360) % Math.floor(360 / this.styles.length);
	    if (rotation > Math.floor(360 / this.styles.length) / 2) {
	      textIndex++;
	      if (textIndex === this.styles.length)
	        textIndex = 0;
	    }
	    var affected = feature.get("affected");
	    return affected ? this.affectedStyles[textIndex] : this.styles[textIndex];
	};
	
	EventHelper.prototype.viewChanged = function viewChanged() {
		if (this.eventLoadingHandle) {
			clearTimeout(this.eventLoadingHandle);
			this.eventLoadingHandle = null;
		}
		var self = this;
		this.eventLoadingHandle = setTimeout(function() {
			self.updateEvents();
		}, 1000);
	};
	
	EventHelper.prototype.addEventChangedListener = function addEventChangedListener(listener) {
		var index = this.eventListChangedListeners.indexOf(listener);
		if (index < 0) {
			this.eventListChangedListeners.push(listener);
		}
	};
	
	EventHelper.prototype.removeEventChangedListener = function removeEventChangedListener(listener) {
		var index = this.eventListChangedListeners.indexOf(listener);
		if (index >= 0) {
			this.eventListChangedListeners.splice(index, 1);
		}
	};

	EventHelper.prototype.getEventTypes = function getEventTypes() {
    	var deferred = this.q.defer();
    	this.q.when(this.eventService.getEventTypes(), function(events) {
    		deferred.resolve(events);
    	});
    	return deferred.promise;
	};
	
	EventHelper.prototype.updateEvents = function updateEvents() {
		var size = this.map.getSize();
		if (!size) {
			return;
		}
		
		var self = this;
    	var ext = this.map.getView().calculateExtent(size);
    	var extent = ol.proj.transformExtent(ext, 'EPSG:3857', 'EPSG:4326');
    	this.q.when(this.eventService.queryEvents({
	    		min_longitude: extent[0],
	    		min_latitude: extent[1],
	    		max_longitude: extent[2],
	    		max_latitude: extent[3]
    	}), function(events) {
			var eventsToAdd = [];
			var eventsToRemoveMap = {};
			for (var key in self.eventMap) {
				eventsToRemoveMap[key] = self.eventMap[key].event;
			}
			
			events.forEach(function(event) {
				var event_id = event.event_id;
				
				if (!self.eventMap[event_id]) {
					eventsToAdd.push(event);
	 			}
				if (eventsToRemoveMap[event_id])
					delete eventsToRemoveMap[event_id];
			});
			if (eventsToAdd.length > 0) {
	    		self.addEventsToView(eventsToAdd);
			}

			var eventsToRemove = [];
			for (var key in eventsToRemoveMap) {
				eventsToRemove.push(eventsToRemoveMap[key]);
			}
			if (eventsToRemove.length > 0) {
	    		self.removeEventsFromView(eventsToRemove);
			}
    		
    		if (eventsToAdd.length > 0 || eventsToRemove.length > 0) {
    			self.eventListChangedListeners.forEach(function(listener) {
    				listener(events);
    			});
    		}
    	});
	};
	
	EventHelper.prototype.createEvent = function createEvent(lat, lon, event_type, eventTypeObj, heading) {
		var self = this;
		var date = new Date();
		var currentTime = date.toISOString();
//		var endTime = new Date(date.getTime() + 60*1000).toISOString(); 
		var params = {
				event_type: event_type,
				s_latitude: lat,
				s_longitude: lon,
				event_time: currentTime,
				start_time: currentTime,
				heading: heading || 0
//				end_time: endTime
			};
		if (eventTypeObj) {
			if (eventTypeObj.description) {
				params.event_name = eventTypeObj.description;
			}
			if (eventTypeObj.category) {
				params.event_category = eventTypeObj.category;
			}
		}
		this.q.when(this.eventService.createEvent(params), function(event_id) {
			self.q.when(self.eventService.getEvent(event_id), function(event) {
				if (event && event.event_type) {
					self.addEventsToView([event]);
				} else {
					self.viewChanged();
				}
			});
		});
	};
	
	EventHelper.prototype.updateAffectedEvents = function updateAffectedEvents(events) {
		var updatedFeatures = [];
		var ids = (events||[]).map(function(e) {return e.event_id;});
		for (var key in this.eventMap) {
			var event = this.eventMap[key].event;
			var feature = this.eventMap[key].feature;
			var affected = ids.indexOf(event.event_id) >= 0;
			if (feature.get('affected') != affected) {
				feature.set('affected', affected);
				feature.setStyle(this.getEventStyle(feature));
				updatedFeatures.push(feature);
			}
		}
	};

	EventHelper.prototype.deleteEvents = function deleteEvents(events) {
		var self = this;
    	var promises = [];
    	events.forEach(function(event) {
    		promises.push(self.eventService.deleteEvent(event.event_id));
    	});
    	if (promises.length > 0) {
	    	this.q.all(promises).then(function() {
		    	self.updateEvents();
	    	});
    	}
 	};
	
	EventHelper.prototype.addEventsToView = function addEventsToView(events) {
		for (var i = 0; i < events.length; i++) {
			var event = events[i];
			var event_id = event.event_id;
			if (!this.eventMap[event_id]) {
				var feature = this.createEventFeature(event);
				this.eventLayer.getSource().addFeature(feature);
				this.eventMap[event_id] = {event: event, feature: feature};
 			}
		}
	};
	
	EventHelper.prototype.removeEventsFromView = function removeEventsFromView(events) {
		for (var i = 0; i < events.length; i++) {
			var event = events[i];
			var event_id = event.event_id;
			if (this.eventMap[event_id]) {
				var feature = this.eventMap[event_id].feature;
				this.eventLayer.getSource().removeFeature(feature);
				delete this.eventMap[event_id];
			}
		}
	};
	
	EventHelper.prototype.getEventForFeature = function getEventForFeature(feature) {
		for (var key in this.eventMap) {
			if (this.eventMap[key].feature === feature) {
				return this.eventMap[key].event;
			}
		}
		return null;
	};

	EventHelper.prototype.createEventFeature = function createEventFeature(event) {
		// Setup current event position
	    var coordinates = [event.s_longitude || 0, event.s_latitude || 0];
	    var position = ol.proj.fromLonLat(coordinates, undefined);
	    var feature = new ol.Feature({geometry: new ol.geom.Point(position), item: event, affected: false});
	    console.log("created an event feature : " + event.event_id);
	    return feature;
	};
	
	EventHelper.prototype.createEventDescriptionHTML = function createEventDescriptionHTML(event) {
		var eventTypes = this.eventTypes || [];
		var result = { content: '', title: undefined };
		result.title = "Event (" + event.event_id + ")";
		result.content = "<table><tbody>";

		// event type or description
		var description = event.event_type;
		for (var i = 0; i < eventTypes.length; i++) {
			var type = eventTypes[i];
			if (type.event_type === event.event_type) {
				description = type.description;
				break;
			}
		}
		if (description) {
			result.content += '<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">TYPE:</span></th><td>' + _.escape(description) + '</td></tr>';
		}
		
		// location and heading
		var dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
		var index = Math.floor(((event.heading/360 + 1/32) % 1) * 16);
		var dir = dirs[index];
		result.content += '<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">LOCATION:</span></th><td style="white-space: nowrap">' + Math.round(event.s_latitude * 10000000) / 10000000 + ',' + Math.round(event.s_longitude * 10000000) / 10000000 + '</td></tr>' +
						'<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">HEADING:</span></th><td>' + Math.round(event.heading * 10000000) / 10000000 + ' [' + dir + ']' + '</td></tr>';
		result.content += '</tbody><table>';
		return result;
	};

	
	/*
	 * Geofence healer
	 */
	var GeofenceHelper = function(map, layer, q, geofenceService){
		// the map
		this.map = map;
		this.geofenceLayer = layer;
		this.geofenceService = geofenceService;
		this.q = q;
		this.styles = {};
		this.targetStyle = null;

		var self = this;
	    layer.setStyle(function(feature, resolution) {
	        self.styles["out"] = new ol.style.Style({
	            fill: new ol.style.Fill({
	              color: [0, 0, 255, 0.1]
	            }),
	            stroke: new ol.style.Stroke({
	              color: [0, 0, 255, 0.3],
	              width: 2
	            })
	        });
	        self.styles["in"] = new ol.style.Style({
	            fill: new ol.style.Fill({
	              color: [255, 0, 128, 0.1]
	            }),
	            stroke: new ol.style.Stroke({
	              color: [255, 0, 128, 0.3],
	              width: 2
	            })
	        });
	        self.targetStyle = new ol.style.Style({
	            fill: new ol.style.Fill({
	              color: [100, 100, 100, 0.1]
	            }),
	            stroke: new ol.style.Stroke({
	              color: [100, 100, 100, 0.3],
	              width: 2
	            })
	        });

		    return function(feature, resolution) {
		    	var style = self.getFeatureStyle(feature);
			    feature.setStyle(style);
			    return style;

		    };
	    }());

		this.loadingHandle = null;
	    this.geofenceMap = {};
		
	    this.map.getView().on('change:center', function() {
	    	self.viewChanged();
	    });
	    this.map.getView().on('change:resolution', function() {
	    	self.viewChanged();
	    });
		this.updateGeofences();
	};

	GeofenceHelper.prototype.getFeatureStyle = function getFeatureStyle(feature) {
		if (feature.get("area")) {
			return this.targetStyle;
		}
		var geofence = feature.get("item");
		if (!geofence) {
			return this.tentativeStyle;
		}
		return this.styles[geofence.direction || "out"];
	};

	GeofenceHelper.prototype.viewChanged = function viewChanged() {
		if (this.loadingHandle) {
			clearTimeout(this.loadingHandle);
			this.loadingHandle = null;
		}
		var self = this;
		this.loadingHandle = setTimeout(function() {
			self.updateGeofences();
		}, 1000);
	};
	
	GeofenceHelper.prototype.updateGeofences = function updateGeofences() {
		var size = this.map.getSize();
		if (!size) {
			return;
		}
		
		var self = this;
    	var ext = this.map.getView().calculateExtent(size);
    	var extent = ol.proj.transformExtent(ext, 'EPSG:3857', 'EPSG:4326');
    	this.q.when(this.geofenceService.queryGeofences({
	    		min_longitude: extent[0],
	    		min_latitude: extent[1],
	    		max_longitude: extent[2],
	    		max_latitude: extent[3]
    	}), function(geofences) {
			var geofencesToAdd = [];
			var geofencesToRemoveMap = {};
			for (var key in self.geofenceMap) {
				geofencesToRemoveMap[key] = self.geofenceMap[key].geofence;
			}
			
			geofences.forEach(function(geofence) {
				var geofence_id = geofence.id;
				
				if (!self.geofenceMap[geofence_id]) {
					geofencesToAdd.push(geofence);
	 			}
				if (geofencesToRemoveMap[geofence_id])
					delete geofencesToRemoveMap[geofence_id];
			});
			if (geofencesToAdd.length > 0) {
	    		self.addGeofencesToView(geofencesToAdd);
			}

			var geofencesToRemove = [];
			for (var key in geofencesToRemoveMap) {
				geofencesToRemove.push(geofencesToRemoveMap[key]);
			}
			if (geofencesToRemove.length > 0) {
	    		self.removeGeofencesFromView(geofencesToRemove);
			}
    	});
	};
	
	GeofenceHelper.prototype.addGeofencesToView = function addGeofencesToView(geofences) {
		for (var i = 0; i < geofences.length; i++) {
			var geofence = geofences[i];
			var geofence_id = geofence.id;
			if (!this.geofenceMap[geofence_id]) {
				var features = this.createGeofenceFeatures(geofence);
				this.geofenceLayer.getSource().addFeatures(features);
				this.geofenceMap[geofence_id] = {geofence: geofence, features: features};
 			}
		}
	};
	
	GeofenceHelper.prototype.removeGeofencesFromView = function removeGeofencesFromView(geofences) {
		for (var i = 0; i < geofences.length; i++) {
			var geofence = geofences[i];
			var geofence_id = geofence.id;
			if (this.geofenceMap[geofence_id]) {
				var self = this;
				var features = this.geofenceMap[geofence_id].features;
				_.each(features, function(feature) {
					self.geofenceLayer.getSource().removeFeature(feature);
				});
				delete this.geofenceMap[geofence_id];
			}
		}
	};

	GeofenceHelper.prototype.createGeofenceFeatures = function createGeofenceFeatures(geofence) {
	    var features = [];
	    let target = null;
	    if (geofence.target && geofence.target.area) {
	      var polygonCoordinates = this.createGeofenceCoordinate(geofence.target.area);
	      var polygon = new ol.geom.Polygon([polygonCoordinates]);
	      var feature = new ol.Feature({geometry: polygon, item: geofence, area: geofence.target.area});
	      features.push(feature);
	      target = feature;
	    }

	    var geometry = geofence.geometry;
	    if (geofence.geometry_type === "circle") {
	      var center = ol.proj.transform([geometry.longitude, geometry.latitude], "EPSG:4326", "EPSG:3857");
	      var circle = new ol.geom.Circle(center, geometry.radius);
	      var feature = new ol.Feature({geometry: circle, item: geofence});
	      features.push(feature);
	    } else {
	      var polygonCoordinates = this.createGeofenceCoordinate(geometry);
	      var polygon = new ol.geom.Polygon([polygonCoordinates]);
	      var feature = new ol.Feature({geometry: polygon, item: geofence});
	      features.push(feature);
	    }
	    return features;
	};

	GeofenceHelper.prototype.createGeofenceCoordinate = function createGeofenceCoordinate(geometry) {
	    var points = [];
	    points.push(ol.proj.transform([geometry.max_longitude, geometry.max_latitude], "EPSG:4326", "EPSG:3857"));
	    points.push(ol.proj.transform([geometry.max_longitude, geometry.min_latitude], "EPSG:4326", "EPSG:3857"));
	    points.push(ol.proj.transform([geometry.min_longitude, geometry.min_latitude], "EPSG:4326", "EPSG:3857"));
	    points.push(ol.proj.transform([geometry.min_longitude, geometry.max_latitude], "EPSG:4326", "EPSG:3857"));
	    points.push(ol.proj.transform([geometry.max_longitude, geometry.max_latitude], "EPSG:4326", "EPSG:3857"));

	    var polygonCoordinates = [];
	    for (var i = 0; i < points.length; i++) {
	      polygonCoordinates.push([points[i][0], points[i][1]]);
	    }
	    return polygonCoordinates;
	};

	GeofenceHelper.prototype.createGeofenceDescriptionHTML = function createGeofenceDescriptionHTML(geofence) {
		var result = { content: '', title: undefined };
		result.title = "Geofence (" + geofence.id + ")";
		result.content = "<table><tbody>";
		result.content += '<tr><th style="white-space: nowrap;text-align:right;"><span style="margin-right:10px;">DIRECTION:</span></th><td style="white-space: nowrap">' + geofence.direction + '</td></tr>';
		result.content += '</tbody><table>';
		return result;
	};

})((function(){
	// tweak to use script-relative path
	var scripts = document.getElementsByTagName('script');
	var scriptUrl = scripts[scripts.length - 1].src;
	return scriptUrl.substring(0, scriptUrl.lastIndexOf('/') + 1);
})());
