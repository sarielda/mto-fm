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

var iotpPdapterAsset = require('../../iotpadapter/asset.js');
var iotpPdapterProbe = require('../../iotpadapter/probe.js');

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

router.get("/capability/device", authenticate, function(req, res){
	res.send({available: iotpPdapterAsset.isIoTPlatformAvailable()});
});
router.post("/device/sync", authenticate, function(req, res){
	Q.when(iotpPdapterAsset.synchronizeAllAsset(), function(response){
		iotpPdapterProbe.resetAssetInfoCache();
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.post("/device/refresh/:deviceId", authenticate, function(req, res){
	var deviceId = req.params.deviceId;
	Q.when(iotpPdapterAsset.updateAssetInfo(deviceId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/device", authenticate, function(req, res){
	Q.when(iotpPdapterAsset.getAllAssetInfo(), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.get("/device/:deviceId", authenticate, function(req, res){
	var deviceId = req.params.deviceId;
	Q.when(iotpPdapterAsset.getAssetInfo(deviceId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router.put("/device/:deviceId", authenticate, function(req, res){
	var deviceId = req.params.deviceId;
	Q.when(iotpPdapterAsset.updateAssetInfo(deviceId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
router["delete"]("/device/:deviceId", authenticate, function(req, res){
	var deviceId = req.params.deviceId;
	Q.when(iotpPdapterAsset.deleteAssetInfo(deviceId), function(response){
		res.send(response);
	})["catch"](function(err){
		return handleAssetError(res, err);
	}).done();
});
