/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var iotpPdapterAsset = module.exports = {};

var _ = require("underscore");
var Q = new require('q');
var dbClient = require('./../cloudantHelper.js');

var queue = require('./queue.js');
var IOTF = require('../iotfclient');
var driverInsightsAsset = require("../driverInsights/asset.js");

var ASSET_DB_NAME = "iotp_asset_map";
var DEFAULT_DRIVER_NAME = "OBDII Driver";
var DEFAULT_DEVICE_TYPE = "OBDII";

/*
 * Module to manage pairs of IoT Platform device and IoT for Automotive asset 
 * The pairs are stored in cloudant DB
 */
_.extend(iotpPdapterAsset, {
	db: null,
	isAnonymouse: false,
	deviceType: DEFAULT_DEVICE_TYPE,
	defaultDriverId: null,
	queue: new queue(),

	_init: function(){
		this.db = dbClient.getDB(ASSET_DB_NAME, this._getDesignDoc());
	},
	/*
	 * Get name of document that have asset information
	 */
	_documentName: function(deviceId, deviceType) {
		return deviceId + '-' + deviceType;
	},
	isIoTPlatformAvailable: function() {
		return !!IOTF.iotfAppClient;
	},
	/*
	 * Add queue to activate or deactivate asset
	 */
	setAssetState: function(deviceId, deviceType, activate) {
		var self = this;
		var deferred = Q.defer();
		if (!activate) {
			Q.when(self._setAssetState(deviceId, deviceType, activate), function(result) {
				deferred.resolve(result);
			})["catch"](function(error) {
				deferred.reject(error);
			});
		} else {
			this.queue.push({
				run: function(params) {
					var d = Q.defer();
					Q.when(self._setAssetState(params.deviceId, params.deviceType, params.activate), function(result) {
						d.resolve(result);
					})["catch"](function(error) {
						d.reject(error);
					});
					return d.promise;
				},
				done: function(result) {
					deferred.resolve(result);
				},
				error: function(error) {
					console.error(error);
					deferred.reject(error);
				},
				canceled: function() {
					deferred.reject({statusCode: 500, message: "request was canceled."});
				},
				params: {
					deviceId: deviceId,
					deviceType: deviceType,
					activate: activate
				}
			});
		}
		return deferred.promise;
	},
	/*
	 * Activate or Deactivate asset
	 */
	_setAssetState: function(deviceId, deviceType, activate) {
		var self = this;
		var deferred = Q.defer();
		Q.when(this.getAssetInfo(deviceId, deviceType), function(assetInfo) {
			Q.when(driverInsightsAsset.updateVehicle(assetInfo.vehicleId, {status: activate ? "active" : "inactive"}, false), function(result) {
				deferred.resolve(assetInfo);
			})["catch"](function(error) {
				if (activate && error && error.response && error.response.statusCode === 404) {
					// Create new asset automatically if it does not exist
					Q.when(self.createAssetInfo(deviceId, deviceType, true), function(assetInfo) {
						deferred.resolve(assetInfo);
					})["catch"](function(error) {
						console.error(error);
						deferred.reject(error);
					});
				} else {
					console.error(error);
					deferred.reject(error);
				}
			});
		})["catch"](function(error) {
			if (activate && error && error.statusCode === 404) {
				// Create new asset automatically if it does not exist
				Q.when(self.createAssetInfo(deviceId, deviceType, true), function(assetInfo) {
					deferred.resolve(assetInfo);
				})["catch"](function(error) {
					console.error(error);
					deferred.reject(error);
				});
			} else {
				console.error(error);
				deferred.reject(error);
			}
		});
		return deferred.promise;
	},
	/*
	 * get all asset
	 */
	getAllAssetInfo: function() {
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.view(ASSET_DB_NAME, "allAssetInfo", {}, function(err, body){
				if(err){
					console.error(err);
					return deferred.reject(err);
				}
				var assetInfos = body.rows.length > 0 ? _.pluck(body.rows, "value") : [];
				deferred.resolve(assetInfos);
			}, function(err) {
				console.error(err);
				deferred.reject(err);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Get IoT for Automotive asset information corresponding to given IoT Platform deviceId
	 */
	getAssetInfo: function(deviceId, deviceType) {
		deviceType = deviceType || this.deviceType || DEFAULT_DEVICE_TYPE;
		var docName = this._documentName(deviceId, deviceType);
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.get(docName, function(err, body) {
				if(err){
					console.error(err);
					return deferred.reject(err);
				}
				var assetInfo = body && body.assetInfo;
				deferred.resolve(assetInfo);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Create IoT for Automotive asset information corresponding to given IoT Platform deviceId
	 */
	createAssetInfo: function(deviceId, deviceType, isActive) {
		var self = this;
		var deferred = Q.defer();
		deviceType = deviceType || this.deviceType || DEFAULT_DEVICE_TYPE;
		Q.when(this._addVehicleToIoTAAsset(deviceId, deviceType, isActive), function(vehicle) {
			Q.when(self._createDriverIfNotExist()).then(function(driverId) {
				// add vehicle information to cloudant DB
				Q.when(self.db, function(db) {
					var docName = self._documentName(deviceId, deviceType);
					var doc = {};
					db.get(docName, null, function(err, body) {
						if (!err) {
							doc = body;
						}
						doc.assetInfo = {
								vehicleId: vehicle.mo_id, 
								driverId: driverId, 
								deviceId: deviceId, 
								deviceType: deviceType
							};
						db.insert(doc, docName, function(err, body){
							if(err){
								console.error(err);
								return deferred.reject(err);
							}
							deferred.resolve(doc.assetInfo);
						});
					});
				})["catch"](function(error) {
					console.error(error);
					deferred.reject(error);
				});
			})["catch"](function(error) {
				console.error(error);
				deferred.reject(error);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Update IoT for Automotive asset information corresponding to given IoT Platform deviceId
	 */
	updateAssetInfo: function(deviceId, deviceType) {
		var deferred = Q.defer();
		Q.when(this._createVehicleFromDevice(deviceId, deviceType, false), function(vehicle) {
			Q.when(self.getAssetInfo(deviceId, deviceType), function(assetInfo) {
				Q.when(driverInsightsAsset.updateVehicle(assetInfo.vehicleId, vehicle), function(response) {
					vehicle.mo_id = response.id;
					deferred.resolve(vehicle);
				})["catch"](function(error) {
					console.error(error);
					deferred.reject(error);
				});
			})["catch"](function(error) {
				console.error(error);
				deferred.reject(error);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Queue a job to read all devices associated with given deviceType and create or update all asset in IoT for Automotive
	 */
	synchronizeAllAsset: function(deviceType) {
		var self = this;
		var deferred = Q.defer();
		this.queue.push({
			run: function(params) {
				var d = Q.defer();
				Q.when(self._synchronizeAllAsset(deviceType), function(result) {
					d.resolve(result);
				})["catch"](function(error) {
					d.reject(error);
				});
				return d.promise;
			},
			done: function(result) {
				deferred.resolve(result);
			},
			error: function(error) {
				console.error(error);
				deferred.reject(error);
			},
			canceled: function() {
				deferred.reject({statusCode: 500, message: "request was canceled."});
			}
		});
		return deferred.promise;
	},
	
	/*
	 * Read all devices associated with given deviceType and create or update all asset in IoT for Automotive
	 */
	_synchronizeAllAsset: function(deviceType) {
		var self = this;
		var deferred = Q.defer();
		Q.when(self._updateAllAsset(deviceType, null, null, {}, []), function(result) {
			Q.when(self.getAllAssetInfo(), function(assetInfos) {
				// remove all assets that have been removed from Iot Platform
				var removed = _.filter(assetInfos, function(assetInfo) {
					return !_.find(result, function(r) {
						return r.deviceId === assetInfo.deviceId && r.deviceType === assetInfo.deviceType;
					});
				});
				if (removed.length > 0) {
					Q.when(self.deleteAssetInfos(removed), function() {
						deferred.resolve(result);
					})["catch"](function(error) {
						console.error(error);
						deferred.reject(error);
					});
				} else {
					deferred.resolve(result);
				}
			})["catch"](function(error) {
				console.error(error);
				deferred.reject(error);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Delete IoT for Automotive asset information corresponding to given IoT Platform deviceId
	 */
	deleteAssetInfo: function(deviceId, deviceType) {
		deviceType = deviceType || this.deviceType || DEFAULT_DEVICE_TYPE;
		var docName = this._documentName(deviceId, deviceType);
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			db.get(docName, null, function(err, body) {
				if (err) {
					console.error(err);
					return deferred.reject(err);
				}
				
				var assetInfo = body.assetInfo;
				var promises = [];
				promises.push(driverInsightsAsset.deleteVehicle(assetInfo.vehicleId));
				var d = Q.defer();
				db.destroy(body._id, body._rev, function(err, data) {
					if (err) {
						console.error(err);
						return d.reject(err);
					}
					return d.resolve(data);
				});
				promises.push(d.promise);
				
				Q.all(promises).then(function() {
					deferred.resolve(assetInfo);
				});
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	
	/*
	 * Delete IoT for Automotive assets corresponding to given IoT Platform devicees
	 */
	deleteAssetInfos: function(assetInfos) {
		var self = this;
		var deferred = Q.defer();
			var promises = [];
		_.each(assetInfos, function(info) {
			promises.push(driverInsightsAsset.deleteVehicle(info.vehicleId));
		});
		var deferred2 = Q.defer();
		Q.when(this.db, function(db) {
			var docs = {keys: _.map(assetInfos, function(info) {return self._documentName(info.deviceId, info.deviceType);})};
			db.fetch(docs, function(err, body) {
				if (err) {
					console.error(err);
					return deferred2.reject(err);
				}
				var docs = _.map(body.rows, function(row) { return {_id:row.doc._id, _rev:row.doc._rev, _deleted:true}; });
				db.bulk({docs: docs}, function(err, body) {
					if (err) {
						console.error(err);
						return deferred2.reject(err);
					}
					deferred2.resolve();
				});
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		promises.push(deferred2.promise);
		Q.all(promises).then(function() {
			deferred.resolve(_.map(assetInfos, function(info) {info.remove = true; return info;}));
		}, function(error) {
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Internal methods
	 */
	/*
	 * Create vehicle object from IoT Platform device data
	 */
	_createVehicleFromDevice: function(deviceId, deviceType, isActive, vendors) {
		var self = this;
		var deferred = Q.defer();
		Q.when(IOTF.iotfAppClient.callApi('GET', 200, true, ['device', 'types', deviceType, 'devices', deviceId]), function(response) {
			// Create vehicle object
			var vehicle = {};
			var deviceInfo = response.deviceInfo;
			if (deviceInfo) {
				if (deviceInfo.serialNumber) {
					vehicle.serial_number = deviceInfo.serialNumber;
				} else {
					vehicle.serial_number = deviceId;
				}
				if (deviceInfo.model) {
					vehicle.model = deviceInfo.model;
				}
				if (deviceInfo.description) {
					vehicle.description = deviceInfo.description;
				}
				if (deviceInfo.manufacturer) {
					vehicle.vendor = deviceInfo.manufacturer;
				}
			}
			if (isActive) {
				vehicle.status = "active";
			}
			var metadata = response.metadata;
			if (metadata) {
				var properties = vehicle.properties = {};
				_.each(metadata, function(value, key) {
					properties[key] = value;
				});
			}
			
			// Create a vendor if not exist
			Q.when(self._createVendorIfNotExist(vehicle.vendor, vendors), function() {
				deferred.resolve(vehicle);
			})["catch"](function(error) {
				console.log("vendor cannot be added");
				delete vehicle.vendor;
				deferred.resolve(vehicle);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.relect(error);
		});
		return deferred.promise;
	},
	/*
	 * Add vehicles corresponding to given devices or update vehicles if they exist already
	 */
	_addOrUpdateAllAsset: function(devices, vendors) {
		var self = this;
		var deferred = Q.defer();

		// Get all documents in cloudant DB that are corresponding to given devices
		Q.when(this._getRegisteredAssetInfoDocs(devices), function(docs) {
			// Create a driver if not exist
			Q.when(self._createDriverIfNotExist()).then(function(driverId) {
				var existingIds = _.map(docs, function(doc) {return doc.id;});
				var existingAssetInfos = _.map(docs, function(doc) {return doc.doc.assetInfo;});
				var results = [];
				var promises = [];
				_.each(devices, function(device) {
					var d = Q.defer();
					Q.when(self._addOrUpdateAsset(device, existingIds, existingAssetInfos, vendors, true), function(result) {
						results.push(result);
						d.resolve(result);
					})["catch"](function(error) {
						console.error(error);
						d.reject(error);
					});
					promises.push(d.promise);
				});
				Q.all(promises).then(function(result) {
				})["catch"](function(error) {
					// go ahead even if there are errors
				}).done(function() {
					driverInsightsAsset.refreshVehicle();
					
					// Add assetInfo documents to cloudant DB when new assets are added to IoT for Automotive
					var assetInfoDocs = [];
					_.each(results, function(doc, index) {
						if (!doc.update) {
							// Change vehicleId and driverId in existing document 
							var docName = self._documentName(doc.assetInfo.deviceId, doc.assetInfo.deviceType);
							var existingDoc = _.find(docs, function(doc) { return doc.id === docName; });
							if (existingDoc) {
								doc._id = existingDoc.doc._id;
								doc._rev = existingDoc.doc._rev;
							}
							doc.assetInfo.driverId = driverId;
							return assetInfoDocs.push(doc);
						}
					});
					if (assetInfoDocs.length > 0) {
						Q.when(self.db, function(db) {
							db.bulk({docs: assetInfoDocs}, function(err, body) {
								if (err) {
									console.error(err);
									return deferred.reject(err);
								}
								var results = _.pluck(assetInfoDocs, "assetInfo");
								existingAssetInfos = _.filter(existingAssetInfos, function(info) {
									return !_.find(results, function(r) {return info.deviceId === r.deviceId && info.deviceType === r.deviceType;});
								});
								results = results.concat(existingAssetInfos);
								deferred.resolve(results);
							});
						});
					} else {
						deferred.resolve(existingAssetInfos);
					}
				});
			})["catch"](function(error) {
				console.error(error);
				deferred.reject(error);
			});
		})["catch"](function(error) {
			console.error(error);
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Add a vehicle corresponding to given device or update vehicle if it exists already
	 */
	_addOrUpdateAsset: function(device, existingIds, existingAssetInfos, vendors, noRefresh) {
		var self = this;
		var deferred = Q.defer();
		// Update existing asset in IoT for Automotive when there is a document corresponding to the device in cloudant DB
		var info = _.find(existingAssetInfos, function(assetInfo) {return assetInfo.deviceId === device.deviceId && assetInfo.deviceType === device.typeId;});
		var isNew = !info;
		Q.when(isNew || self._updateVehicleInIoTAAsset(info.deviceId, info.deviceType, info.vehicleId, vendors, noRefresh), function() {
			if (!isNew) {
				info.update = true;
				deferred.resolve(info);
			}
		})["catch"](function(error) {
			if (error && error.response && error.response.statusCode === 404) {
				isNew = true;
			} else {
				deferred.reject(error);
			}
		}).done(function() {
			if (isNew) {
				// Add new asset to IoT for Automotive when there is no document corresponding to the device in cloudant DB
				Q.when(self._addVehicleToIoTAAsset(device.deviceId, device.typeId, false, vendors, noRefresh), function(vehicle) {
					// If the asset is successfully added, prepare new assetInfo doc that will be created in cloudant DB later
					var docName = self._documentName(device.deviceId, device.typeId);
					var assetInfo = {
						deviceId: device.deviceId,
						deviceType: device.typeId,
						vehicleId: vehicle.mo_id
					};
					deferred.resolve({_id: docName, assetInfo: assetInfo});
				})["catch"](function(error) {
					deferred.reject(error);
				});
			}
		});
		return deferred.promise;
	},
	/*
	 * Check if the asset corresponding to given device really exists in IoT for Automotive or not
	 * In case user intentionally remove the asset directly using IoT for Automotive API, 
	 * corresponding asset does not exist while corresponding document exists in cloudant DB
	 */
	_isAssetRegistered: function(device, existingIds, existingAssetInfos) {
		var deferred = Q.defer();
		var docName = this._documentName(device.deviceId, device.typeId);
		var found = _.contains(existingIds, docName);
		if (found) {
			// check if asset really exists or not
			var info = _.find(existingAssetInfos, function(assetInfo) {return assetInfo.deviceId === device.deviceId && assetInfo.deviceType === device.typeId;});
			Q.when(driverInsightsAsset.getVehicle(info.vehicleId), function(vehicle) {
				return deferred.resolve(!!vehicle);
			})["catch"](function(error) {
				if (error && error.response && error.response.statusCode === 404) {
					deferred.resolve(false);
				} else {
					console.error(error);
					deferred.resolve(true);
				}
			});
		} else {
			return deferred.resolve(false);
		}
		return deferred.promise;
	},
	/*
	 * Add vehicles corresponding to given devices or update vehicles if they already exist
	 */
	_getRegisteredAssetInfoDocs: function(devices) {
		var self = this;
		var deferred = Q.defer();
		Q.when(this.db, function(db) {
			// get already registered asset information from cloudant DB 
			var docs = {keys: _.map(devices, function(d) { return self._documentName(d.deviceId, d.typeId); })};
			db.fetch(docs, function(err, body) {
				if (err) {
					console.error(err);
					deferred.reject(err);
				} else {
					var res = _.filter(body.rows, function(row) {return !row.error && row.doc;});
					deferred.resolve(res);
				}
			});
		})["catch"](function(error) {
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Add a vehicle to IoT for Automotive Asset
	 */
	_addVehicleToIoTAAsset: function(deviceId, deviceType, isActive, vendors, noRefresh) {
		var deferred = Q.defer();
		Q.when(this._createVehicleFromDevice(deviceId, deviceType, isActive, vendors), function(vehicle) {
			Q.when(driverInsightsAsset.addVehicle(vehicle, noRefresh), function(response) {
				vehicle.mo_id = response.id;
				deferred.resolve(vehicle);
			})["catch"](function(error) {
				deferred.reject(error);
			});
		})["catch"](function(error) {
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Update all asset
	 */
	_updateAllAsset: function(deviceType, bookmark, deferred, vendors, results) {
		var self = this;
		deviceType = deviceType || this.deviceType || DEFAULT_DEVICE_TYPE;
		deferred = deferred || Q.defer();
		var opts = bookmark ? {_bookmark: bookmark} : null;
		Q.when(IOTF.iotfAppClient.callApi('GET', 200, true, ['device', 'types', deviceType, 'devices'], null, opts), function(response) {
			bookmark = response.bookmark;
			Q.when(self._addOrUpdateAllAsset(response.results, vendors), function(result) {
				if (results) {
					results = results.concat(result);
				}
				if (bookmark) {
					self._updateAllAsset(deviceType, bookmark, deferred, vendors, results);
				} else {
					deferred.resolve(results);
				}
			})["catch"](function(error) {
				deferred.reject(error);
			});
		})["catch"](function(error) {
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Update a vehicle to IoT for Automotive Asset
	 */
	_updateVehicleInIoTAAsset: function(deviceId, deviceType, vehicleId, vendors, noRefresh) {
		var deferred = Q.defer();
		Q.when(this._createVehicleFromDevice(deviceId, deviceType, false, vendors), function(vehicle) {
			Q.when(driverInsightsAsset.updateVehicle(vehicleId, vehicle, false, noRefresh), function(response) {
				vehicle.mo_id = response.id;
				deferred.resolve(vehicle);
			})["catch"](function(error) {
				deferred.reject(error);
			});
		})["catch"](function(error) {
			deferred.reject(error);
		});
		return deferred.promise;
	},
	/*
	 * Create a vendor with given id in IoT for Automotive asset when it does not exist
	 */
	_createVendorIfNotExist: function(vendor, vendors) {
		var deferred = Q.defer();
		if (!vendor || driverInsightsAsset.isAnonymouse) {
			deferred.resolve();
		} else if (vendors && vendors[vendor]) {
			deferred.resolve(vendors[vendor]);
		} else {
			Q.when(driverInsightsAsset.getVendor(vendor), function(response) {
				if (vendors) {
					vendors[vendor] = vendor;
				}
				return deferred.resolve(vendor);
			})["catch"](function(error) {
				if (error.response.statusCode === 404 /* NOT FOUND */) {
					// Create new vendor if not found
					Q.when(driverInsightsAsset.addVendor({vendor: vendor, type: "Manufacturer", status: "active"}), function(response) {
						if (vendors) {
							vendors[vendor] = vendor;
						}
						return deferred.resolve(vendor);
					})["catch"](function(error) {
						console.error(error);
						deferred.reject(error);
					});
				} else {
					console.error(error);
					deferred.reject(error);
				}
			});
		}
		return deferred.promise;
	},
	/*
	 * Create a driver with given id in IoT for Automotive asset when it does not exist
	 */
	_createDriverIfNotExist: function() {
		var self = this;
		var deferred = Q.defer();
		if (driverInsightsAsset.isAnonymouse) {
			deferred.resolve();
		} else if (this.defaultDriverId) {
			deferred.resolve(this.defaultDriverId);
		} else {
			Q.when(driverInsightsAsset.getDriverList({name: DEFAULT_DRIVER_NAME}), function(response) {
				var driverId = response.data && response.data.length > 0 && response.data[0].driver_id;
				self.defaultDriverId = driverId;
				return deferred.resolve(driverId);
			})["catch"](function(error) {
				if (error.response.statusCode === 404 /* NOT FOUND */) {
					// Create new driver if not found
					Q.when(driverInsightsAsset.addDriver({name: DEFAULT_DRIVER_NAME, status: "active"}), function(response) {
						var driverId = response && response.id;
						self.defaultDriverId = driverId;
						return deferred.resolve(driverId);
					})["catch"](function(error) {
						console.error(error);
						deferred.reject(error);
					});
				} else {
					console.error(error);
					deferred.reject(error);
				}
			});
		}
		return deferred.promise;
	},
	
	/*
	 * Database design
	 */
	/*
	 * cloudant db design document
	 */
	_getDesignDoc: function(){
		var allAssetInfoMap = function(doc){
			if (doc.assetInfo) {
				emit(doc._id, doc.assetInfo);
			}
		};
		var designDoc = {
			_id: '_design/' + ASSET_DB_NAME,
			views: {
				allAssetInfo: {
					map: allAssetInfoMap.toString()
				}
			},
		};
		return designDoc;
	}
});
iotpPdapterAsset._init();
