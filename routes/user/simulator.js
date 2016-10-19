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
 * REST apis for car devices
 */
var router = module.exports = require('express').Router();
var Q = require('q');
var _ = require('underscore');
var fs = require('fs-extra');
var moment = require("moment");
var chance = require("chance")();
var debug = require('debug')('simulator');
debug.log = console.log.bind(console);

var driverInsightsAsset = require('../../driverInsights/asset.js');
var driverInsightsProbe = require('../../driverInsights/probe.js');

var authenticate = require('./auth.js').authenticate;

var request = require("request");

var _sendError = function(res, err){
	//{message: msg, error: error, response: response}
	console.error('error: ' + JSON.stringify(err));
	var response = err.response;
	var status = (response && (response.status||response.statusCode)) || 500;
	var message = err.message || (err.data && err.data.message) || err;
	return res.status(status).send(message);
};

/*
 * REST apis for fleet simulator
 */
var VENDOR_NAME = "IBM";
var NUM_OF_SIMULATOR = 5;


var deviceModelSamples; // caches the template file in memory
var deviceModelSamplesNextSampleIndex = 0;
var _getDeviceModelInfo = function(){
	var samples = deviceModelSamples;
	if (!Array.isArray(samples)){
		samples = fs.readJsonSync('_deviceModelInfoSamples.json').templates;
		if (!samples){
			console.error('Failed to load ./_deviceModelInfoSamples.json');
			samples = [];
		}
		deviceModelSamples = samples;
	}
	// randomly pick one
	if (!samples || samples.length === 0)
		return {};
	return samples[(deviceModelSamplesNextSampleIndex++) % samples.length];
};

var _deactivateFleeSimulatedVehicles = function(num){
	var deferred = Q.defer();
	debug("Try to find free active simulated cars [" + num + "]");
	Q.when(driverInsightsAsset.getVehicleList({"vendor": VENDOR_NAME, "status": "active"}), function(response){
		var vehicles = response.data;
		debug("Active vehicles: " + JSON.stringify(vehicles));
		var defList = [];
		for(var i=0; i<vehicles.length; i++){
			var deactivate = false;
			var mo_id = vehicles[i].mo_id;
			var last_probe_time = driverInsightsProbe.getLastProbeTime(mo_id);
			if(last_probe_time){
				var since_last_modified = moment().diff(moment(last_probe_time), "seconds");
				debug("since last modified = " + since_last_modified);
				if(since_last_modified > 600){
					deactivate = true;
				}
			}else{
				// server may have been rebooted
				deactivate = true;
			}
			if(deactivate){
				num--;
				debug("try to inactivate: " + mo_id );
				defList.push(driverInsightsAsset.updateVehicle(mo_id, {"status": "inactive"}));
			}
		}
		Q.all(defList).then(function(){
			deferred.resolve(num);
		});
	})["catch"](function(err){
		debug("No active free simulated cars.");
		deferred.resolve(num);
	}).done();
	return deferred.promise;
};

var _createNewSimulatedVehicles = function(num){
	debug("Simulated car will be created [" + num + "]");
	var deferred = Q.defer();
	var defList = [];
	for(var i=0; i < num; i++){
		var vehicle = {
			"vendor": VENDOR_NAME, 
			"serial_number": "s-" + chance.hash({length: 6})
		};
		vehicle.properties = _getDeviceModelInfo();
		vehicle.model = vehicle.properties.makeModel;
		defList.push(driverInsightsAsset.addVehicle(vehicle));
	}
	Q.all(defList).then(function(){
		debug("created " + num + " vehicles");
		deferred.resolve();
	})["catch"](function(err){
		debug("Failed to create simulated car");
		deferred.reject(err);
	}).done();
	return deferred.promise;
};

var _createSimulatedVehicles = function(res, exsiting_vehicles){
	var num = exsiting_vehicles ? (NUM_OF_SIMULATOR - exsiting_vehicles.length) : NUM_OF_SIMULATOR;
	debug("Get inactive simulated cars [" + num + "]");
	if(num === 0){
		return Q();
	}
	return Q.when(_deactivateFleeSimulatedVehicles(num)).then(function(){
		return _createNewSimulatedVehicles(num);
	});
};

var _getAvailableVehicles = function(res, exsiting_vehicles){
	Q.when(_createSimulatedVehicles(res, exsiting_vehicles))
	.then(function(){
		debug("get inactive cars again");
		return driverInsightsAsset.getVehicleList({"vendor": VENDOR_NAME, "status": "inactive"});
	}).then(function(response){
		debug("_getAvailableVehicles: " + response);
		res.send(response);
	})["catch"](function(err){
		debug("Failed to get simulated cars");
		_sendError(res, err);
	}).done();
};

router.get("/simulatedVehicles", authenticate, function(req, res){
	Q.when(driverInsightsAsset.getVendor(VENDOR_NAME), function(response){
		debug("There is vendor: " + VENDOR_NAME);
		Q.when(driverInsightsAsset.getVehicleList({"vendor": VENDOR_NAME, "status": "inactive"}), function(response){
			if(response && response.data && response.data.length < NUM_OF_SIMULATOR){
				// create additional vehicles
				_getAvailableVehicles(res, response.data);
			}else{
				res.send(response);
			}
		})["catch"](function(err){
			// assume vehicle is not available 
			_getAvailableVehicles(res);
		}).done();
	})["catch"](function(err){
		var status = (err.response && (err.response.status||err.response.statusCode)) || 500;
		if(status === 404){
			debug("Create a vendor for simulator");
			Q.when(driverInsightsAsset.addVendor({"vendor": VENDOR_NAME, "type": "Vendor", "status":"Active"}), function(response){
				debug("A vendor for simulator is created");
				_getAvailableVehicles(res);
			})["catch"](function(err){
				_sendError(res, err);
			}).done();
		}else{
			_sendError(res, err);
		}
	}).done();
});

var DRIVER_NAME = "simulated_driver";
var _createSimulatedDriver = function(res){
	var promise = driverInsightsAsset.addDriver({"name": DRIVER_NAME, "status":"Active"});
	Q.when(promise, function(response){
		var data = {data: [ {driver_id: response.id, name: DRIVER_NAME} ]};
		debug("Simulated driver was created");
		res.send(data);
	})["catch"](function(err){
		_sendError(res, err);
	}).done();
}
;
router.get("/simulatedDriver", authenticate, function(req, res){
	Q.when(driverInsightsAsset.getDriverList({"name": DRIVER_NAME}), function(response){
			res.send(response);
	})["catch"](function(err){
		// assume driver is not available 
		_createSimulatedDriver(res);
	}).done();
});
