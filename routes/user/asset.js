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
var debug = require('debug')('device');
debug.log = console.log.bind(console);

var driverInsightsAsset = require('../../driverInsights/asset.js');

var authenticate = require('./auth.js').authenticate;

var request = require("request");

function handleAssetError(res, err) {
	//{message: msg, error: error, response: response}
	console.error('error: ' + JSON.stringify(err));
	var response = err.response;
	var status = (response && (response.status||response.statusCode)) || 500;
	var message = err.message || (err.data && err.data.message) || err;
	return res.status(status).send(message);
}

router.post("/vehicle", authenticate, function(req, res){
	var vehicle = req.body && req.body.vehicle;
	Q.when(driverInsightsAsset.addVehicle(vehicle), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/vehicle", authenticate, function(req, res){
	var params = null;
	if (req.query.num_rec_in_page || req.query.num_page) {
		params = {num_rec_in_page: req.query.num_rec_in_page||50, num_page: req.query.num_page||1};
	}
	Q.when(driverInsightsAsset.getVehicleList(params), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/vehicle/:vehicleId", authenticate, function(req, res){
	var vehicleId = req.params.vehicleId;
	Q.when(driverInsightsAsset.getVehicle(vehicleId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/vehicle/:vehicleId", authenticate, function(req, res){
	var vehicleId = req.params.vehicleId;
	var overwrite = !req.query.addition || req.query.addition.toLowerCase() !== 'true';
	Q.when(driverInsightsAsset.updateVehicle(vehicleId, req.body, overwrite), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/vehicle/:vehicleId", authenticate, function(req, res){
	var vehicleId = req.params.vehicleId;
	Q.when(driverInsightsAsset.deleteVehicle(vehicleId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	});
});

router.post("/driver", authenticate, function(req, res){
	var driver = req.body && req.body.driver;
	Q.when(driverInsightsAsset.addDriver(driver), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/driver", authenticate, function(req, res){
	var params = null;
	if (req.query.num_rec_in_page || req.query.num_page) {
		params = {num_rec_in_page: req.query.num_rec_in_page||50, num_page: req.query.num_page||1};
	}
	Q.when(driverInsightsAsset.getDriverList(params), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/driver/:driverId", authenticate, function(req, res){
	var driverId = req.params.driverId;
	Q.when(driverInsightsAsset.getDriver(driverId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/driver/:driverId", authenticate, function(req, res){
	var driverId = req.params.driverId;
	var overwrite = !req.query.addition || req.query.addition.toLowerCase() !== 'true';
	Q.when(driverInsightsAsset.updateDriver(driverId, req.body, overwrite), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/driver/:driverId", authenticate, function(req, res){
	var driverId = req.params.driverId;
	Q.when(driverInsightsAsset.deleteDriver(driverId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	});
});
router.post("/vendor", authenticate, function(req, res){
	var vendor = req.body && req.body.vendor;
	Q.when(driverInsightsAsset.addVendor(vendor), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/vendor", authenticate, function(req, res){
	var params = null;
	if (req.query.num_rec_in_page || req.query.num_page) {
		params = {num_rec_in_page: req.query.num_rec_in_page||50, num_page: req.query.num_page||1};
	}
	Q.when(driverInsightsAsset.getVendorList(params), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/vendor/:vendor", authenticate, function(req, res){
	var vendor = req.params.vendor;
	Q.when(driverInsightsAsset.getVendor(vendor), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/vendor/:vendor", authenticate, function(req, res){
	var vendor = req.params.vendor;
	var overwrite = !req.query.addition || req.query.addition.toLowerCase() !== 'true';
	Q.when(driverInsightsAsset.updateVendor(vendor, req.body, overwrite), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/vendor/:vendor", authenticate, function(req, res){
	var vendor = req.params.vendor;
	Q.when(driverInsightsAsset.deleteVendor(vendor), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	});
});
router.get("/eventtype", authenticate, function(req, res){
	var params = null;
	if (req.query.num_rec_in_page || req.query.num_page) {
		params = {num_rec_in_page: req.query.num_rec_in_page||50, num_page: req.query.num_page||1};
	}
	Q.when(driverInsightsAsset.getEventTypeList(params), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/eventtype/:event_type", authenticate, function(req, res){
	var id = req.params.event_type;
	Q.when(driverInsightsAsset.getEventType(id), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/eventtype/:event_type", authenticate, function(req, res){
	var id = req.params.event_type;
	Q.when(driverInsightsAsset.updateEventType(id, req.body), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/eventtype/:event_type", authenticate, function(req, res){
	var id = req.params.event_type;
	Q.when(driverInsightsAsset.deleteEventType(id), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	});
});
router.post("/rule", authenticate, function(req, res){
	var rule = req.body && req.body.rule;
	Q.when(driverInsightsAsset.addRule(rule), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/rule", authenticate, function(req, res){
	var params = null;
	if (req.query.num_rec_in_page || req.query.num_page) {
		params = {num_rec_in_page: req.query.num_rec_in_page||50, num_page: req.query.num_page||1};
	}
	Q.when(driverInsightsAsset.getRuleList(params), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/rule/:rule_id", authenticate, function(req, res){
	var rule_id = req.params.rule_id;
	Q.when(driverInsightsAsset.getRule(rule_id), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/rule/:rule_id", authenticate, function(req, res){
	var rule_id = req.params.rule_id;
	Q.when(driverInsightsAsset.updateRule(rule_id, req.body), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/rule/:rule_id", authenticate, function(req, res){
	var rule_id = req.params.rule_id;
	Q.when(driverInsightsAsset.deleteRule(rule_id), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	});
});

/*
 * register a device and responds its credentials
 */
router.get('/device/credentials/:deviceId', authenticate, function(req,res){
	var deviceId = req.params.deviceId;
	var ownerId = req.query && req.query.ownerOnly && req.get("iota-starter-uuid");
	res.send("Noop");
});
