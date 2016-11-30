/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var _ = require("underscore");
var Q = new require('q');
var request = require("request");
var cfenv = require("cfenv");
var debug = require('debug')('asset');
debug.log = console.log.bind(console);

var driverInsightsAsset = {
	assetConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = userVcapSvc.iotforautomotive || VCAP_SERVICES.iotforautomotive;
		if (vcapSvc) {
			var assetCreds = vcapSvc[0].credentials;
			return {
				baseURL: assetCreds.api + "asset",
				tenant_id : assetCreds.tenant_id,
				username : assetCreds.username,
				password : assetCreds.password
			};
		}
		throw new Exception("!!! no provided credentials for Asset Data Management. using shared one !!!");
	}(),

	_mergeObject: function(obj1, obj2) {
		for (var key in obj1) {
			if (key in obj2) {
				if (typeof(obj1[key]) === 'object') {
					this._mergeObject(obj1[key], obj2[key]);
				} else {
					obj1[key] = obj2[key];
				}
			}
		}
		for (var key in obj2) {
			if (!(key in obj1)) {
				obj1[key] = obj2[key];
			}
		}
		return obj1;
	},
	/*
	 * Vehicle apis
	 */
	getVehicleList: function(params){
		return this._getAssetList("vehicle", params);
	},
	getVehicle: function(mo_id){
		return this._getAsset("vehicle", mo_id);
	},
	addVehicle: function(vehicle, noRefresh){
		vehicle = this._mergeObject({
					status:"inactive",
					properties: {
						fuelTank: 60
					}
				}, vehicle||{});
		return this._addAsset("vehicle", vehicle, !noRefresh);
	},
	updateVehicle: function(id, vehicle, overwrite, noRefresh){
		return this._updateAsset("vehicle", id || vehicle.mo_id, vehicle, overwrite, !noRefresh);
	},
	refreshVehicle: function(){
		return this._refreshAsset("vehicle");
	},
	deleteVehicle: function(mo_id){
		return this._deleteAsset("vehicle", mo_id);
	},

	/*
	 * Driver apis
	 */
	getDriverList: function(params){
		return this._getAssetList("driver", params);
	},
	getDriver: function(driver_id){
		return this._getAsset("driver", driver_id);
	},
	addDriver: function(driver, noRefresh){
		driver = _.extend({"status":"active"}, driver||{});
		return this._addAsset("driver", driver, !noRefresh);
	},
	updateDriver: function(id, driver, overwrite, noRefresh){
		return this._updateAsset("driver", id || driver.driver_id, driver, overwrite, !noRefresh);
	},
	refreshDriver: function(){
		return this._refreshAsset("driver");
	},
	deleteDriver: function(driver_id){
		return this._deleteAsset("driver", driver_id);
	},

	/*
	 * Vendor api
	 */
	getVendorList: function(params){
		return this._getAssetList("vendor", params);
	},
	getVendor: function(vendor){
		return this._getAsset("vendor", vendor);
	},
	addVendor: function(vendor){
		vendor = _.extend({"status":"active"}, vendor||{});
		return this._addAsset("vendor", vendor, false);
	},
	updateVendor: function(id, vendor, overwrite){
		return this._updateAsset("vendor", id || vendor.vendor, vendor, overwrite, false);
	},
	deleteVendor: function(vendor){
		return this._deleteAsset("vendor", vendor);
	},

	/*
	 * EventType api
	 */
	getEventTypeList: function(params){
		return this._getAssetList("eventtype", params);
	},
	getEventType: function(id){
		return this._getAsset("eventtype", id);
	},
	addEventType: function(event_type, noRefresh){
		return this._addAsset("eventtype", event_type, !noRefresh);
	},
	updateEventType: function(id, event_type, overwrite, noRefresh) {
		return this._updateAsset("eventtype", id || event_type.event_type, event_type, overwrite, !noRefresh);
	},
	refreshEventType: function(){
		return this._refreshAsset("eventtype");
	},
	deleteEventType: function(id){
		return this._deleteAsset("eventtype", id);
	},

	/*
	 * Rule api
	 */
	getRuleList: function(params){
		return this._getAssetList("rule", params);
	},
	getRule: function(id){
		return this._getAsset("rule", id);
	},
	getRuleXML: function(id){
		var api = "/rule/" + id + "/rule";
		return this._run("GET", api, null, null, true);
	},
	addRule: function(rule, ruleXML){
		var self = this;
		var deferred = Q.defer();
		Q.when(this._runForm("POST", "/rule", rule, function(form) {
			if (ruleXML) {
				form.append("file", ruleXML);
			}
		}), function(response) {
			Q.when(self._run("POST", "/rule/refresh"), function(refreshed){
				deferred.resolve(response);
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	updateRule: function(id, rule, ruleXML, overwrite) {
		var deferred = Q.defer();
		var self = this;
		if (overwrite) {
			var api = "/rule/" + id;
			Q.when(this._runForm("PUT", api, rule, function(form) {
				if (ruleXML) {
					form.append("file", ruleXML);
				}
			}), function(response){
				Q.when(self._run("POST", "/rule/refresh"), function(refreshed){
					deferred.resolve(response);
				})["catch"](function(err){
					deferred.reject(err);
				}).done();
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		} else {
			Q.when(this.getRule(id), function(existingRule) {
				rule = self._mergeObject(existingRule, rule);
				Q.when(self.getRuleXML(id), function(existingXML) {
					ruleXML = ruleXML || existingXML;
					Q.when(self.updateRule(id, rule, ruleXML, true), function(response) {
						deferred.resolve(response);
					})["catch"](function(err){
						deferred.reject(err);
					}).done();
				});
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		}
		return deferred.promise;
	},
	deleteRule: function(id){
		return this._deleteAsset("rule", id);
	},
	/*
	 * Get list of assets
	 */
	_getAssetList: function(context, params){
		return this._run("GET", "/" + context, params || {num_rec_in_page: 50, num_page: 1});
	},

	/*
	 * Get an asset
	 */
	_getAsset: function(context, id){
		if(!id){
			return Q.reject({message: "id must be specified."});
		}
		var api = "/" + context + "/" + id;
		return this._run("GET", api);
	},

	/*
	 * Add an asset
	 */
	_addAsset: function(context, asset, refresh){
		var deferred = Q.defer();
		Q.when(this._addOrUpdateAsset(context, null, asset, refresh), function(response) {
			deferred.resolve(response);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},

	/*
	 * Update an asset
	 */
	_updateAsset: function(context, id, asset, overwrite, refresh){
		if(!id){
			return Q.reject({message: "id must be specified."});
		}
		var deferred = Q.defer();
		var self = this;
		if (overwrite) {
			Q.when(this._addOrUpdateAsset(context, id, asset, refresh), function(response) {
				deferred.resolve(response);
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		} else {
			Q.when(this._getAsset(context, id), function(existingAsset) {
				asset = self._mergeObject(existingAsset, asset);
				Q.when(self._addOrUpdateAsset(context, id, asset, refresh), function(response) {
					deferred.resolve(response);
				})["catch"](function(err){
					deferred.reject(err);
				}).done();
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		}
		return deferred.promise;
	},

	_addOrUpdateAsset: function(context, id, asset, refresh) {
		var self = this;
		var deferred = Q.defer();
		var api = "/" + context + (id?"/"+id:"");
		Q.when(this._run(id?"PUT":"POST", api, null, asset), function(response){
			if (refresh) {
				Q.when(self._refreshAsset(context), function(refreshed) {
					deferred.resolve(response);
				})["catch"](function(err){
					deferred.reject(err);
				}).done();
			} else {
				deferred.resolve(response);
			}
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	/*
	 * Refresh assets on the vehicle data hub hosts
	 */
	_refreshAsset: function(context) {
		var deferred = Q.defer();
		Q.when(this._run("POST", "/" + context + "/refresh"), function(response){
			deferred.resolve(response);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	/*
	 * Delete an asset
	 */
	_deleteAsset: function(context, id){
		if(!id){
			return Q.reject({message: "id must be specified."});
		}
		var api = "/" + context + "/" + id;
		return this._run("DELETE", api);
	},

	/*
	 * Internal methods
	 */
	_run: function(method, api, uriParam, body, isText){
		if(!api){
			errorback();
			return;
		}
		var config = this.assetConfig;
		var uri = config.baseURL + api + "?tenant_id=" + config.tenant_id;
		if(uriParam === null || uriParam === undefined){
			//do nothing
		}else if(typeof uriParam === "string"){
			uri += uriParam; // "&key1=value1&key2=value2..."
		}else if(typeof uriParam === "object"){
			uri += "&" + Object.keys(uriParam).map(function(key){return key + "=" + uriParam[key];}).join("&");
		}
		var options = {
				method: method,
				url: uri,
				headers: {
					"Content-Type": "application/json; charset=UTF-8"
				},
				rejectUnauthorized: false,
				auth: {
					user: config.username,
					pass: config.password,
					sendImmediately: true
				}
		};
		if(body){
			options.body = JSON.stringify(body);
			options.headers["Content-Length"] = Buffer.byteLength(options.body);
		}

		debug("Request: " + JSON.stringify(options));
		var deferred = Q.defer();
		request(options, function(error, response, body){
			if (!error && response.statusCode >= 200 && response.statusCode < 300) {
				deferred.resolve(isText ? body : JSON.parse(body));
			} else {
				var msg = 'asset: error(' + method + ":" + api + '): '+ body;
				console.error(msg);
				deferred.reject({message: msg, error: error, response: response});
			}
		});
		return deferred.promise;
	},
	
	_runForm: function(method, api, params, formCallback){
		var config = this.assetConfig;
		var uri = config.baseURL + api + "?tenant_id=" + config.tenant_id;
		var options = {
				method: method,
				url: uri,
				headers: {
					"Content-Type": "multipart/form-data"
				},
				rejectUnauthorized: false,
				auth: {
					user: config.username,
					pass: config.password,
					sendImmediately: true
				}
		};

		debug("Request: " + JSON.stringify(options));
		var deferred = Q.defer();
		var req = request(options, function(error, response, body){
			if (!error && response.statusCode >= 200 && response.statusCode < 300) {
				deferred.resolve(JSON.parse(body));
			} else {
				var msg = 'asset: error(' + method + ":" + api + '): '+ body;
				console.error(msg);
				deferred.reject({message: msg, error: error, response: response});
			}
		});
		var form = req.form();
		for (var key in params) {
			form.append(key, params[key]);
		}
		formCallback(form);
		return deferred.promise;
	}
};

module.exports = driverInsightsAsset;
