/**
 * Copyright 2017 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AHKPKY&popup=n&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var _ = require("underscore");
var Q = new require('q');
var debug = require('debug')('assetApiFactory');
debug.log = console.log.bind(console);

var maximoApi = require("./maximoAssetApi.js");
var iot4aApi = require("./iot4aAssetApi.js");

var assetApiFactory = {
	getAssetApi: function(){
		if (maximoApi.assetConfig) {
			return maximoApi;
		} else if (iot4aApi.assetConfig) {
			return iot4aApi;
		}
		throw new Exception("No asset API exists.");
	}
};

module.exports = assetApiFactory;
