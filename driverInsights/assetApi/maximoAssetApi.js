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
var debug = require('debug')('maximoAssetApi');
debug.log = console.log.bind(console);

var attributesMap = {
		"vehicle": {id: "assetnum", objectstructure: "IOTCVASSET", map: {
			"assetnum": "mo_id",
			"assetuid": "internal_mo_id",
			"iotcvmodel": "model",
			"serialnum": "serial_number",
			"status": {"name": "status", "value": function(val) {
				return val === "OPERATING" ? "active" : "inactive";
			}, "rvalue": function(val) {
				return (val && val.toLowerCase()) === "active" ? "OPERATING" : "NOT READY";
			}},
			"vendor": "vendor",
			"iotcvwidth": "width",
			"iotcvheight": "height",
			"iotcvtype": "type",
			"iotcvusage": "usage",
			"personid": "driver_id",
			"description": "description",
			"siteid": "siteid",
			"classstructureid": "classstructureid",
			"assetspec": {"name": "properties", "value": function(val) {
				var props = {};
				_.each(val, function(obj) {
					if (obj.assetattrid) {
						var key = obj.assetattrid.toLowerCase();
						if (obj.alnvalue !== undefined)
							props[key] = obj.alnvalue;
					}
				});
				return props;
			}, "rvalue": function(val) {
				var assetspec = [];
				_.each(val, function(value, key) {
					var spec = {assetattrid: key.toUpperCase(), section: "IOTCVCV", linearassetspecid: 0};
					if (value === undefined) {
						return;
					}
					spec.alnvalue = value.toString();
					assetspec.push(spec);
				});
				return assetspec;
			}}
		}, "rextend": function(asset) {
			asset.assettype = "!CV!";
		}},
		"driver": {id: "personid", objectstructure: "IOTCVDRIVER", map: {
			"personid": "driver_id",
			"personuid": "internal_driver_id",
			"displayname": "name",
			"iotcvcontract": "contract_id",
			"status": {"name": "status", "value": function(val) {
				return val.toLowerCase();
			}, "rvalue": function(val) {
				return val && val.toUpperCase();
			}}
		}},
		"vendor": {id: "company", objectstructure: "MXVENDOR", map: {
			"company": "vendor",
			"name": "name",
			"homepage": "website",
			"type": {"name": "type", "value": function(val) {
				if (!val) return val;
				val = val.toUpperCase();
				if (val === "V") {
					return "Vendor";
				} else if (val === "M") {
					return "Manufacturer";
				} else if (val === "C") {
					return "Courier";
				} else if (val === "I") {
					return "Internal";
				}
			}, "rvalue": function(val) {
				if (!val) return val;
				return val.charAt(0).toUpperCase();
			}},
			"description": "description",
			"disabled": {"name": "status", "value": function(val) {
				return val ? "active": "inactive";
			}, "rvalue": function(val) {
				return (val && val.toLowerCase()) !== "active";
			}},
		}, "rextend": function(asset) {
			asset.currencycode = "USD";
			asset.orgid = maximoAssetApi.assetConfig.maximo.orgid;
		}},
		"eventtype": {id: "assetattrid", objectstructure: "IOTCVEVENTTYPE", map: {
			"assetattrid": "event_type",
			"assetattributeid": "internal_event_type_id",
			"iotcvaffecttype": "affected_type",
			"iotcvcategory": "category",
			"iotcvactive": {"name": "status", "value": function(val) {
				return val ? "active": "inactive";
			}, "rvalue": function(val) {
				return (val && val.toLowerCase()) === "active";
			}},
			"description": "description"
		}, "rextend": function(asset) {
			asset.datatype = "ALN";
		}, "searchCondition": function() {
			return {iotcvactive: true};
		}},
		"rule": {id: "rulenum", objectstructure: "IOTCVRULE", map: {
			"rulenum": "rule_id",
			"iotcvruleid": "internal_rule_id",
			"type": "type",
			"active": {"name": "status", "value": function(val) {
				return val ? "active": "inactive";
			}, "rvalue": function(val) {
				return (val && val.toLowerCase()) === "active";
			}},
			"description": "description",
			"rule": "rule"
		}},
		"organization": {id: "orgid", objectstructure: "MXORGANIZATION", map: {
			"orgid": "orgid",
			"site": {"name": "site", "value": function(val) {
				var sites = [];
				var attrs = ["siteid", "maxcelly", "maxcellx", "startlongitude", "startlatitude", "endlongitude", "endlatitude", "description", "active"];
				_.each(val, function(obj) {
					var site = {};
					_.each(attrs, function(attr) {
						if (obj[attr]) {
							site[attr] = obj[attr];
						}
					});
					sites.push(site);
				});
				return sites;
			}, "rvalue": function(val) {
			}}
		}}
};

var maximoAssetApi = {
	assetConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = userVcapSvc.iotforautomotive || VCAP_SERVICES.iotforautomotive;
		if (vcapSvc && vcapSvc.length > 0) {
			var iot4a_cred = vcapSvc[0].credentials;
			if (iot4a_cred.maximo) {
				var vdh = iot4a_cred.vehicle_data_hub && iot4a_cred.vehicle_data_hub.length > 0 && iot4a_cred.vehicle_data_hub[0];
				var vdhCreds = {
					baseURL: vdh ? ("https://" + vdh) : (iot4a_cred.api + "vehicle"),
					username : iot4a_cred.username,
					password : iot4a_cred.password
				};
				var assetCreds = iot4a_cred.maximo;
		        var maximoCreds = {
		        	baseURL: assetCreds.api ? assetCreds.api : (iot4a_cred.api + "maximo"),
		        	internalURL: assetCreds.internalURL,
		        	orgid: assetCreds.orgid,		
		        	classificationid: assetCreds.classificationid || "STARTER APPLICATION",		
		            username: assetCreds.username,
		            password: assetCreds.password
		          };
				var creds = {tenant_id: iot4a_cred.tenant_id, vdh: vdhCreds, maximo: maximoCreds};
				return creds;
			}
		}
	}(),
	
	isNative: function() {
		return true;
	},
	
	_getUrl: function(context, islean) {
		var cred = this.assetConfig.maximo;
		var objectName = this._getResourceObjectName(context).toLowerCase();
		var api = cred.baseURL || (cred.protocol + '://' + cred.hostname + ':' + cred.port + cred.auth_schema);
		var url =  api + '/oslc/os/' + objectName;
		if (islean) {
			url += '?lean=1';
		}
		return url;
	},
	_getResourceObjectName: function(context) {
		return attributesMap[context] ? attributesMap[context].objectstructure : context;
	},
	_getResourceObjectAttributes: function(context) {
		var map = attributesMap[context] ? attributesMap[context].map : null;
		return map ? _.keys(map) : null;
	},
	_getSearchCondition: function(context) {
		var conditions = (attributesMap[context] && attributesMap[context].searchCondition) ? attributesMap[context].searchCondition() : null;
		return _.map(conditions, function(value, key) {
			if (_.isString(value)) {
				return key + '=' + '"' + value + '"';
			} else {
				return key + '=' + value;
			}
		});
	},
	_filterAssets: function(context, assets) {
		return (attributesMap[context] && attributesMap[context].filter) ? attributesMap[context].filter(assets) : assets;
	},
	_getAssetObject: function(context, maximoAsset) {
		if (!attributesMap[context]) {
			return maximoAsset;
		}
		return this._convert(maximoAsset, attributesMap[context].map, attributesMap[context].extend);
	},
	_getMaximoObject: function(context, asset) {
		if (!attributesMap[context]) {
			return asset;
		}
		var map = {};
		_.each(attributesMap[context].map, function(value, key) {
			if (_.isObject(value)) {
				map[value.name] = {name: key, value: value.rvalue};
			} else {
				map[value] = key;
			}
		});
		var maximoAsset = this._convert(asset, map, attributesMap[context].rextend);
		return maximoAsset;
	},
	_extractId: function(context, id) {
		// vehicle id might contain siteId. remove it.
		if (id && context === "vehicle" && id.indexOf(":") > 0) {
			var strs = id.split(":");
			if (strs.length > 1) {
				return strs[1];
			}
		}
		return id;
	},
	_convert: function(org, map, extend) {
		var asset = {};
		_.each(org, function(value, key) {
			var assetElement = map[key];
			if (assetElement) {
				if (_.isObject(assetElement)) {
					if (assetElement.name) {
						asset[assetElement.name] = 
							_.isFunction(assetElement.value) ? assetElement.value(value) : assetElement.value;
					}
				} else {
					asset[assetElement] = value;
				}
			}
		});
		if (_.isFunction(extend)) {
			extend(asset);
		}
		return asset;
	},
	/*
	 * Get list of assets
	 */
	getAssetList: function(context, params){
		var deferred = Q.defer();
		var attributes = this._getResourceObjectAttributes(context);
		var conditions = this._getSearchCondition(context);
		Q.when(this._query(context, attributes, conditions), function(result) {
			deferred.resolve({data: result});
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},

	/*
	 * Get an asset
	 */
	getAsset: function(context, id){
		id = this._extractId(context, id);
		var deferred = Q.defer();
		var self = this;
		Q.when(this._query(context, null, null, id), function(result) {
			Q.when(self._request(result.href + '?lean=1', 'GET'), function(result) {
				deferred.resolve(self._getAssetObject(context, result));
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},

	addOrUpdateAsset: function(context, id, asset, refresh) {
		id = this._extractId(context, id);
		var deferred = Q.defer();
		var self = this;
		Q.when(!id || this._query(context, null, null, id), function(result) {
			var existing = id && result;
			var url = existing ? result.href + '?lean=1' : self._getUrl(context, true);
			var method_override = existing ? 'PATCH' : null;
			Q.when(self._addAditionalInfo(context, asset, existing), function(asset) {
				var maximoAsset = self._getMaximoObject(context, asset);
				Q.when(self._request(url, 'POST', method_override, maximoAsset), function(result) {
					if (!result) {
						result = {id: asset.mo_id, siteid: asset.siteid};
					}
					if (refresh) {
						Q.when(self.refreshAsset(context), function(refreshed){
							deferred.resolve(result);
						})["catch"](function(err){
							deferred.reject(err);
						}).done();
					} else {
						deferred.resolve(result);
					}
				})["catch"](function(err){
					console.log(err.message);
					deferred.reject(err);
				}).done();
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
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
		var config = this.assetConfig.vdh;
		var url = config.baseURL;
		var assettype = context == "eventtype" ? "event_type" : context;
		url += "/refresh?asset=" + assettype;
		if (this.assetConfig.tenant_id) {
			url += '&tenant_id=' + this.assetConfig.tenant_id;
		}

		Q.when(this._request(url, 'POST', null, null, config), function(result) {
			deferred.resolve(result);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	/*
	 * Delete an asset
	 */
	deleteAsset: function(context, id, refresh){
		id = this._extractId(context, id);
		var deferred = Q.defer();
		var self = this;
		Q.when(this._query(context, null, null, id), function(result) {
			Q.when(self._request(result.href + '?lean=1', 'POST', 'DELETE'), function(result) {
				if (refresh) {
					Q.when(self.refreshAsset(context), function(refreshed){
						deferred.resolve({id: id});
					})["catch"](function(err){
						deferred.reject(err);
					}).done();
				} else {
					deferred.resolve(result);
				}
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	
	getRuleXML: function(id){
		var deferred = Q.defer();
		var self = this;
		Q.when(this._query('rule', ['rule'], null, id), function(result) {
			deferred.resolve(result.rule);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	
	addRule: function(rule, ruleXML){
		var deferred = Q.defer();
		var context = 'rule';
		if (ruleXML) {
			rule.rule = ruleXML.replace(/\n|\r/g, '');
		}
		Q.when(this.addOrUpdateAsset(context, null, rule, true), function(result) {
			deferred.resolve({id: rule.rule_id});
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	
	updateRule: function(id, rule, ruleXML, overwrite) {
		var deferred = Q.defer();
		var context = 'rule';
		if (ruleXML) {
			rule.rule = ruleXML.replace(/\n|\r/g, '');
		}
		Q.when(this.addOrUpdateAsset(context, id, rule, true), function(result) {
			deferred.resolve(result);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	
	_addAditionalInfo: function(context, asset, existing) {
    	var deferred = Q.defer();
		if (!existing && context === "vehicle") {
			var lon = asset && asset.defaultLocation && asset.defaultLocation.longitude;
			var lat = asset && asset.defaultLocation && asset.defaultLocation.latitude;

			var defs = [];
			defs.push(this._setAssetId(context, 6, asset));
			defs.push(this._setSiteId(lon, lat, asset));
			defs.push(this._setClassificationId(asset));
			Q.all(defs).then(function(){
				deferred.resolve(asset);
			})["catch"](function(err){
				deferred.reject(err);
			}).done();
		} else {
			deferred.resolve(asset);
		}
		return deferred.promise;
	},
	
	_setClassificationId: function(asset) {
		var deferred = Q.defer();
		
		var config = this.assetConfig.maximo;
		var url = this._getUrl("mxclassification", true);
		var classificationid = config.classificationid;
		if (classificationid) {
			url += ('&oslc.select=classstructureid');
			url += ('&oslc.where=classificationid="' + classificationid + '"');
			var options = this._createOptions(url, 'GET');
			request(options, function(error, response, body) {
				if (!error && response.statusCode >= 200 && response.statusCode < 300) {
					var result = JSON.parse(body);
					var member = result.member;
					if (member && member.length > 0) {
						asset.classstructureid = member[0].classstructureid;
			        }
					deferred.resolve(asset);
				} else {
					var msg = 'asset: error(' + url + '): '+ body;
					deferred.reject({message: msg, error: error, response: response});
				}
			});
		} else {
			deferred.reject(asset);
		}
		return deferred.promise;
	},
	
	_setAssetId: function(context, length, asset, deferred) {
	    var id = "", i, random;
	    for (i = 0; i < length; i++) {
	        random = Math.random() * 16 | 0;
	        id += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random))
	                .toString(16);
	    }
	    id = id.toUpperCase();

	    var self = this;
	    if (!deferred)
	    	deferred = Q.defer();
	    Q.when(this.getAsset(context, id), function(result) {
	    	self._setAssetId(context, length, asset, deferred);
		})["catch"](function(err){
			var status = (err.response && (err.response.status||err.response.statusCode)) || 500;
			if(status === 404) {
				asset.mo_id = id;
				deferred.resolve(asset);
			} else {
				deferred.reject(err);
			}
	    });
		return deferred.promise;
	},
	
	_setSiteId: function(lon, lat, asset) {
		var deferred = Q.defer();
		var self = this;
		Q.when(this.sites || this.getAsset("organization", this.assetConfig.maximo.orgid), function(result) {
			if (!self.sites) {
				self.sites = _.map(_.filter(result.site, function(s) { return s.active; }), function(s) {
					return {id: s.siteid, slon: s.startlongitude, slat: s.startlatitude, elon: s.endlongitude, elat: s.endlatitude};
				});
			}
			var siteid = null;
			_.each(self.sites, function(s) {
				if (!siteid || (lon && lat && s.slon <= lon && lon <= s.elon && s.slat <= lat && lat <= s.elat)) {
					siteid = s.id;
				}
			});
			if (siteid) {
				asset.siteid = siteid;
			}
			deferred.resolve(asset);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},

	_createOptions: function(url, method, method_override, body, basicauth) {
		var options = {
				method: method,
				url: url,
				headers: {
					"Content-Type": "application/json"
				}
		};
		if (basicauth) {
			options.rejectUnauthorized = false;
			options.auth = {
				user: basicauth.username,
				pass: basicauth.password,
				sendImmediately: true
			};
		} else {
			var creds = this.assetConfig.maximo;
			var maxauth = creds.username + ':' + creds.password;
			options.headers.maxauth = new Buffer(maxauth).toString('base64');
		}
		if (method_override) {
			if (method_override === 'MERGE') {
				options.headers.patchtype = 'MERGE';
				options.headers['x-method-override'] = 'PATCH';
			} else {
				options.headers['x-method-override'] = method_override;
			}
		}
		if(body){
			options.body = JSON.stringify(body);
			options.headers["Content-Length"] = Buffer.byteLength(options.body);
		}
		return options;
	},
	
	_query: function(context, attributes, conditions, id, pagesize, pageno) {
		var config = this.assetConfig.maximo;
		var where = conditions || [];
		if (id) {
			var idname = attributesMap[context] ? attributesMap[context].id : null;
			where.push(idname + '="' + id + '"');
		}
		
		var url = this._getUrl(context, true);
		if (attributes && attributes.length > 0) {
			url += '&oslc.select=' + attributes.join(',');
		}
		if (where && where.length > 0) {
			url += '&oslc.where=' + where.join(' and ');
		}
		if (pagesize) {
			url += '&oslc.pageSize=' + pagesize;
		}
		if (pageno) {
			url += '&pageno=' + pageno;
		}

		var options = this._createOptions(url, 'GET');

		var self = this;
		var deferred = Q.defer();
		request(options, function(error, response, body){
			if (!error && response.statusCode >= 200 && response.statusCode < 300) {
				var result = JSON.parse(body);
				var member = result.member;
				if (id) {
					if (member && member.length > 0) {
						if (config.internalURL) {
							// workaround for secure gateway. maximo api may return internal resource uri
							member[0].href = member[0].href.replace(config.internalURL, config.baseURL);
						}
						deferred.resolve(attributes ? self._getAssetObject(context, member[0]) : member[0]);
			        } else {
						deferred.reject({statusCode: 404, message: "Not found", response: {statusCode: 404, message: "Not found"}});
			        }
				} else {
					deferred.resolve(attributes ? _.map(self._filterAssets(context, member), function(m) {return self._getAssetObject(context, m);}) : member);
				}
			} else {
				var msg = 'asset: error(' + url + '): '+ body;
				deferred.reject({message: msg, error: error, response: response});
			}
		});
		return deferred.promise;
	},

	_request: function(url, method, method_override, body, config) {
		var options = this._createOptions(url, method, method_override, body, config);

		var deferred = Q.defer();
		request(options, function(error, response, body){
			if (!error && response.statusCode >= 200 && response.statusCode < 300) {
				deferred.resolve(body && JSON.parse(body));
			} else {
				var msg = 'asset: error(' + method + ":" + url + '): '+ body;
				deferred.reject({message: msg, error: error, response: response});
			}
		});
		return deferred.promise;
	}
};

module.exports = maximoAssetApi;
