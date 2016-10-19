/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var driverInsightsGeofence = module.exports = {};

var _ = require("underscore");
var Q = new require('q');
var moment = require("moment");

var dbClient = require('./../cloudantHelper.js');
var driverInsightsAsset = require('./asset.js');
var ruleGenerator = require('./ruleGenerator.js');

var debug = require('debug')('geofence');
debug.log = console.log.bind(console);

var DB_NAME = "geofence";
var GEOFENCE_RULE_TYPE = 100000;
var GEOFENCE_MAX_RULE_ID_NUM = 100000;

/*
 * geofence json
 * {
 *		message: message text returned when rule is applied
 *		direction: "in" or "out", "out" by default
 * 		geometry_type: "rectangle" or "circle", "rectangle" by default
 * 		geometry: {
 * 			min_latitude: start latitude of geo fence, valid when geometry_type is rectangle
 * 			min_longitude: start logitude of geo fence, valid when geometry_type is rectangle 
 * 			max_latitude:  end latitude of geo fence, valid when geometry_type is rectangle
 * 			max_longitude:  start logitude of geo fence, valid when geometry_type is rectangle
 * 			latitude: center latitude of geo fence, valid when geometry_type is circle
 * 			longitude: center logitude of geo fence, valid when geometry_type is circle 
 * 			radius: radius of geo fence, valid when geometry_type is circle 
 * 		}, 
 * 		target: {
 * 			area: {
 *	 			min_latitude: start latitude of rule target, valid when direction is out
 * 				min_longitude: start logitude of rule target, valid when direction is out 
 * 				max_latitude:  end latitude of rule target, valid when direction is out
 * 				max_longitude:  start logitude of rule target, valid when direction is out
 * 			}
 * 		},
 * 		actions: [{
 * 			message: message string returned when rule is applied
 * 			parameters: [{
 * 				key: key string for this parameter
 * 				value: value string for this parameter
 * 			},...]
 * 		},...]
 * }
 */
_.extend(driverInsightsGeofence, {
	db: null,

	_init: function(){
		this.db = dbClient.getDB(DB_NAME, this._getDesignDoc());
	},

	queryGeofence: function(min_latitude, min_longitude, max_latitude, max_longitude) {
		var deferred = Q.defer();
		Q.when(this._queryGeofenceDoc(min_longitude, min_latitude, max_longitude, max_latitude), function(response) {
			var result = response.map(function(doc) {
				doc.geofence.id = doc.id;
				return doc.geofence;
			});
			deferred.resolve(result);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},

	getGeofence: function(geofence_id) {
		var deferred = Q.defer();
		Q.when(this._getGeofenceDoc(geofence_id), function(doc) {
			doc.geofence.id = doc.id;
			deferred.resolve(doc.geofence);
		})["catch"](function(err){
			deferred.reject(err);
		}).done();
		return deferred.promise;
	},
	
	/*
	 * Create an unique Id for rule xml. RuleID must be unique within VehicleActionRule rule xmls. They must be managed by application. 
	 * If the application create VehicleActionRule rules other than geofence, ids for those rules must be taken care of to calculate the uniqueness.
	 */
	_getAvailableRuleXMLId: function() {
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.view(DB_NAME, "geofenceRuleXmlIds", {}, function(err, body) {
				if (err) {
					console.error(err);
					return deferred.reject(err);
				} else {
					var result = _.map(body.rows, function(value) {
						return value.value;
					});						
					for (var i = 0; i < GEOFENCE_MAX_RULE_ID_NUM; i++) {
						var rule_xml_id = GEOFENCE_RULE_TYPE + i;
						if (!_.contains(result, rule_xml_id)) {
							deferred.resolve(rule_xml_id);
							return;
						}
					}
					deferred.reject({message: "no id is available", statusCode: 500});
				}
			});
		});
		return deferred.promise;
	},
	
	createGeofence: function(geofence) {
		var self = this;
		var deferred = Q.defer();
		Q.when(this._getAvailableRuleXMLId(), function(rule_xml_id) {
			var rule = {description: "geofence rule", type: "Action", status: "active"};
			Q.when(driverInsightsAsset.addRule(rule, self._createGeofenceEmptyRuleXML(rule_xml_id)), function(response) {
				var promises = [];
				var geofence_id = response.id;
				var ruleXML = self._createGeofenceRuleXML(geofence_id, geofence, rule_xml_id);
				promises.push(driverInsightsAsset.updateRule(geofence_id, rule, ruleXML, true));
				promises.push(self._createDoc(response.id, {geofence: geofence, rule_xml_id: rule_xml_id}));
				
				Q.all(promises).then(function(data) {
					deferred.resolve({id: response.id});
				}, function(err) {
					deferred.reject(err);
				});
			})["catch"](function(err){
				deferred.reject(err);
			});
		})["catch"](function(err){
			deferred.reject(err);
		});
		return deferred.promise;
	},
	
	updateGeofence: function(geofence_id, geofence) {
		var deferred = Q.defer();
		var rule = {description: "geofence rule", type: "Action", status: "active"};
		var ruleXML = this._createGeofenceRuleXML(geofence_id, geofence);
		var promises = [];
		promises.push(driverInsightsAsset.updateRule(geofence_id, rule, ruleXML, true));
		promises.push(this._updateDoc(geofence_id, {geofence: geofence}));
		Q.all(promises).then(function(data) {
			deferred.resolve({id: geofence_id});
		}, function(err) {
			deferred.reject(err);
		});
		return deferred.promise;
	},
	
	_deleteGeofenceRule: function(rule_id, successOnNoExists) {
		var deferred = Q.defer();
		var rule = {description: "geofence being removed", type: "Action", status: "inactive"};
		Q.when(driverInsightsAsset.updateRule(rule_id, rule, null, true), function(response) {
			Q.when(driverInsightsAsset.deleteRule(rule_id), function(response) {
				deferred.resolve({id: rule_id});
			})["catch"](function(err){
				if (err.statusCode === 404 && successOnNoExists) {
					deferred.resolve();
				} else {
					deferred.reject(err);
				}
			}).done();
		})["catch"](function(err){
			if (err.statusCode === 404 && successOnNoExists) {
				deferred.resolve();
			} else {
				deferred.reject(err);
			}
		}).done();
		return deferred.promise;
	},
	
	deleteGeofence: function(geofence_id) {
		var promises = [];
		promises.push(this._deleteGeofenceRule(geofence_id, true));
		promises.push(this._deleteDoc(geofence_id));
		
		var deferred = Q.defer();
		Q.when(promises).then(function(result) {
			deferred.resolve({id: geofence_id});
		})["catch"](function(err){
			deferred.reject(err);
		}).done();

		return deferred.promise;
	},

	_createGeofenceRuleXMLTemplate: function(rule_xml_id) {
		return {
				rule_id: rule_xml_id,
				rule_type: GEOFENCE_RULE_TYPE,
				name: "Geofence Rule",
				description: "Geofence rule created by iota starter app rule engine.",
				condition: {
					pattern: "geofence"
				},
				actions: []
			};
	},

	_createGeofenceEmptyRuleXML: function(rule_xml_id) {
		return ruleGenerator.createVehicleAcitonRuleXML(this._createGeofenceRuleXMLTemplate(rule_xml_id));
	},
	
	_createGeofenceRuleXML: function(geofence_id, geofenceJson, rule_xml_id) {
		if (!geofenceJson) {
			return "";
		}
		
		var ruleJson = this._createGeofenceRuleXMLTemplate(rule_xml_id);
		
		var range = geofenceJson.direction || "out";
		if (geofenceJson.geometry_type === "circle") {
			ruleJson.condition.location_condition = {
				range: range,
				latitude: geofenceJson.geometry.latitude,
				longitude: geofenceJson.geometry.longitude,
				radius: geofenceJson.geometry.radius
			}
		} else {
			ruleJson.condition.location_condition = {
				range: range,
				start_latitude: geofenceJson.geometry.min_latitude,
				start_longitude: geofenceJson.geometry.min_longitude,
				end_latitude: geofenceJson.geometry.max_latitude,
				end_longitude: geofenceJson.geometry.max_longitude
			}
		}
		if (geofenceJson.target) {
			ruleJson.target = {};
			if (geofenceJson.target.area) {
				ruleJson.target.areas = [geofenceJson.target.area];
			}
		}
		var message = geofenceJson.message || (range === "out" ? "Vehicle is out of bounds" : "Vehicle is in bounds");
		ruleJson.actions = geofenceJson.actions
						|| {vehicle_actions: [{
							message: message,
							parameters: [{
								key: "message_type",
								value: "geofence"
							},{
								key: "source_id",
								value: geofence_id
							},{
								key: "longitude",
								value: "CarProbe.Longitude"
							},{
								key: "latitude",
								value: "CarProbe.Latitude"
							}]
						}]};
		return ruleGenerator.createVehicleAcitonRuleXML(ruleJson);
	},
	
	_queryGeofenceDoc: function(min_latitude, min_longitude, max_latitude, max_longitude) {
		var deferred = Q.defer();
		if (isNaN(min_longitude) || isNaN(min_latitude) || isNaN(max_longitude) || isNaN(max_latitude)) {
			Q.when(this.db, function(db) {
				db.view(DB_NAME, "allGeofenceLocation", {}, function(err, body){
					if (err) {
						console.error(err);
						return deferred.reject(err);
					} else {
						var result = _.map(body.rows, function(value) {
							var doc = value.value;
							if (doc) {
								doc.id = value.id;
								delete doc._id;
								delete doc._rev;
							}
							return doc;
						});						
						deferred.resolve(result);
					}
				});
			});
		} else if (!isNaN(min_longitude) && !isNaN(min_latitude) && !isNaN(max_longitude) && !isNaN(max_latitude)) {
			Q.when(this.db, function(db) {
				var  bbox = min_latitude + "," + min_longitude + "," + max_latitude + "," + max_longitude;
				db.geo(DB_NAME, "geoindex", {bbox:bbox, include_docs:true}, function(err, body) {
					if (err) {
						console.error(err);
						return deferred.reject(err);
					} else {
						var result = _.map(body.rows, function(value) {
							var doc = value.doc;
							if (doc) {
								doc.id = value.id;
								delete doc._id;
								delete doc._rev;
							}
							return doc;
						});						
						deferred.resolve(result);
					}
				});
			});
		} else {
			deferred.reject({statusCode: 400, message: "missing parameter: min_latitude, min_longitude, max_latitude and max_longitude are specified."});
		}
		return deferred.promise;
	},
	
	_getGeofenceDoc: function(geofence_id) {
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.find({selector:{_id:geofence_id}}, function(err, body) {
				if (err) {
					console.error(err);
					return deferred.reject(err);
				} else {
					deferred.resolve(body.docs && body.docs.length > 0?body.docs[0] : null);
				}
			});
		});
		return deferred.promise;
	},
	
	_createDoc: function(id, doc) {
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.insert(doc, id, function(err, body) {
				if (err) {
					console.error(err);
					return deferred.reject(err);
				} else {
					deferred.resolve(body);
				}
			});
		});
		return deferred.promise;
	},
	
	_updateDoc: function(id, doc) {
		var deferred = Q.defer();

		// get the current document for the device
		Q.when(this.db, function(db) {
			db.get(id, null, function(err, body) {
				if (err) {
					console.error(err);
					deferred.reject(err);
					return;
				}
				
				_.extend(body, doc);
				db.insert(body, null, function(err, body) {
					if (err) {
						console.error(err);
						deferred.reject(err);
					} else {
						deferred.resolve(body);
					}
				});
			});
		});
		return deferred.promise;
	},
	
	_deleteDoc: function(geofence_id, successOnNoExists) {
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.get(geofence_id, null, function(err, body) {
				if (err) {
					if (err.statusCode === 404 && successOnNoExists) {
						deferred.resolve(err);
					} else {
						console.error(err);
						deferred.reject(err);
					}
					return;
				}
				
				db.destroy(body._id, body._rev, function(err, data) {
					if (err) {
						console.error(err);
						deferred.reject(err);
					} else {
						deferred.resolve(data);
					}
				});
			});
		});
		return deferred.promise;
	},
	
	_getDesignDoc: function(){
		var allGeofenceLocation = function(doc) {
			if (doc.geofence && doc.geofence.geometry) {
				emit(doc._id, doc.geofence);
			}
		};
		var geofenceRuleXmlIds = function(doc) {
			if (doc.rule_xml_id) {
				emit(doc._id, doc.rule_xml_id);
			}
		};
		var geofenceIndexer = function(doc){
			if (doc.geofence && doc.geofence.geometry) {
				var geofence = doc.geofence.geometry;
				var geometry = {type: "Polygon", coordinates: []};
				if (geofence.target && geofence.target.area) {
					var area = geofence.target.area;
					geometry.coordinates.push([
			   					    [parseFloat(area.min_longitude), parseFloat(area.min_latitude)],
			   					    [parseFloat(area.max_longitude), parseFloat(area.min_latitude)],
			   					    [parseFloat(area.max_longitude), parseFloat(area.max_latitude)],
			   					    [parseFloat(area.min_longitude), parseFloat(area.max_latitude)],
			   					    [parseFloat(area.min_longitude), parseFloat(area.min_latitude)]
			   					  ]);
				} else if (!isNaN(geofence.min_longitude)) {
					geometry.coordinates.push([
		   					    [parseFloat(geofence.min_longitude), parseFloat(geofence.min_latitude)],
		   					    [parseFloat(geofence.max_longitude), parseFloat(geofence.min_latitude)],
		   					    [parseFloat(geofence.max_longitude), parseFloat(geofence.max_latitude)],
		   					    [parseFloat(geofence.min_longitude), parseFloat(geofence.max_latitude)],
		   					    [parseFloat(geofence.min_longitude), parseFloat(geofence.min_latitude)]
		   					  ]);
				} else if (!isNaN(geofence.longitude)) {
		            var r = 0.0001;
					geometry.coordinates.push([
		   					    [parseFloat(geofence.longitude)-r, parseFloat(geofence.latitude)-r],
		   					    [parseFloat(geofence.longitude)+r, parseFloat(geofence.latitude)-r],
		   					    [parseFloat(geofence.longitude)+r, parseFloat(geofence.latitude)+r],
		   					    [parseFloat(geofence.longitude)-r, parseFloat(geofence.latitude)+r],
		   					    [parseFloat(geofence.longitude)-r, parseFloat(geofence.latitude)-r]
		   					  ]);
				}
				st_index(geometry);
			}
		};
		var designDoc = {
				_id: '_design/' + DB_NAME,
				views: {
					allGeofenceLocation: {
						map: allGeofenceLocation.toString()
					},
					geofenceRuleXmlIds: {
						map: geofenceRuleXmlIds.toString()
					},
				},
				st_indexes: {
					geoindex: {
						index: geofenceIndexer.toString()
					}
				}
		};
		return designDoc;
	},
});
driverInsightsGeofence._init();
