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
var request = require('../requestSecureGw.js'); 
var cfenv = require("cfenv");
var debug = require('debug')('iot4AAssetApi');
debug.log = console.log.bind(console);

var iot4aAssetApi = {
	assetConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = userVcapSvc.iotforautomotive || VCAP_SERVICES.iotforautomotive;
		if (vcapSvc) {
			var assetCreds = vcapSvc[0].credentials;
			if (assetCreds) {
				return {
					baseURL: assetCreds.api + "asset",
					tenant_id : assetCreds.tenant_id,
					username : assetCreds.username,
					password : assetCreds.password
				};
			}
		}
	}(),
	/*
	 * Get list of assets
	 */
	getAssetList: function(context, params){
		return this._run("GET", "/" + context, params);
	},

	/*
	 * Get an asset
	 */
	getAsset: function(context, id){
		var api = "/" + context + "/" + id;
		return this._run("GET", api);
	},
	
	addOrUpdateAsset: function(context, id, asset, refresh) {
		var self = this;
		var deferred = Q.defer();
		var api = "/" + context + (id?"/"+id:"");
		Q.when(this._run(id?"PUT":"POST", api, null, asset), function(response){
			if (refresh) {
				Q.when(self.refreshAsset(context), function(refreshed){
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
	 * Refresh asset information
	 */
	refreshAsset: function(context) {
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
	deleteAsset: function(context, id){
		var deferred = Q.defer();
		var self = this;
		var api = "/" + context + "/" + id;
		Q.when(this._run("DELETE", api), function(response) {
			Q.when(self.refreshAsset(context), function() {
				deferred.resolve(response);
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
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
		return deferred.promise;
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

module.exports = iot4aAssetApi;
