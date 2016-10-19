/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var driverInsightsProbe = module.exports = {};

var _ = require("underscore");
var Q = new require('q');
var request = require("request");
var cfenv = require("cfenv");
var fs = require("fs-extra");
var moment = require("moment");
var driverInsightsAlert = require("./fleetalert.js");
var debug = require('debug')('probe');
debug.log = console.log.bind(console);

var lastProbeTimeByMoId = {};

_.extend(driverInsightsProbe, {
	last_prob_ts: moment().valueOf(),

	driverInsightsConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = userVcapSvc.iotforautomotive || VCAP_SERVICES.iotforautomotive;
		if (vcapSvc) {
			var dirverInsightsCreds = vcapSvc[0].credentials;
			return {
				baseURL: dirverInsightsCreds.api + "driverinsights",
				tenant_id : dirverInsightsCreds.tenant_id,
				username : dirverInsightsCreds.username,
				password : dirverInsightsCreds.password
			};
		}
		throw new Exception("!!! no provided credentials for DriverInsights. using shared one !!!");
	}(),

	vdhConfig: function(){
		var userVcapSvc = JSON.parse(process.env.USER_PROVIDED_VCAP_SERVICES || '{}');
		var vcapSvc = userVcapSvc.iotforautomotive || VCAP_SERVICES.iotforautomotive;
		if (vcapSvc) {
			var vdhCreds = vcapSvc[0].credentials;
			var vdh = vdhCreds.vehicle_data_hub && vdhCreds.vehicle_data_hub.length > 0 && vdhCreds.vehicle_data_hub[0];
			return {
				baseURL: vdh ? ("https://" + vdh) : (vdhCreds.api + "vehicle"),
				tenant_id : vdhCreds.tenant_id,
				username : vdhCreds.username,
				password : vdhCreds.password
			};
		}
		throw new Exception("!!! no provided credentials for Vehicle Data Hub. using shared one !!!");
	}(),
	
	_addAuthOption: function(config, options) {
		if (config.username && config.password) {
			return _.extend(options, {
				rejectUnauthorized: false,
				auth: {
					user: config.username,
					pass: config.password,
					sendImmediately: true
				}
			});
		}
		return options;
	},

	sendRawData: function(carProbeData, callback) {
		var deviceType = "User Own Device";
		var deviceId = carProbeData.mo_id;
		
		// check mandatory field
		if(!carProbeData.trip_id || carProbeData.trip_id.length === 0 || !carProbeData.lng || !carProbeData.lat || isNaN(carProbeData.lng) || isNaN(carProbeData.lat) || isNaN(carProbeData.speed)){
			callback("error");
			return;
		}
		var ts = carProbeData.ts || Date.now();
		// keep the last probe for each mo_id
		lastProbeTimeByMoId[deviceId] = ts;

		var payload = {
				// assign ts if missing
				ts: ts,
				timestamp: moment(ts).format('YYYY-MM-DDTHH:mm:ss.SSSZ'), // ISO8601
				trip_id: carProbeData.trip_id,
				speed: carProbeData.speed,
				mo_id: carProbeData.mo_id,
				driver_id: carProbeData.driver_id, //FIXME Get car probe requires driver_id as of 20160731
				longitude: carProbeData.lng,
				latitude: carProbeData.lat,
				heading: carProbeData.heading || 0
			};
		if(carProbeData.props){
			payload.props = carProbeData.props;
		}

		Q.when(driverInsightsProbe.sendProbeData([payload], "sync"), function(result){
			debug("events: " + result);
			var affected_events = null;
			var notified_messages = null;
			if(result && result.contents){
				// previous version of sendCarProbe returned an array of affected events directly in contents
				// new version returns affectedEvents and notifiedMessages objects
				affected_events = _.isArray(result.contents) ? result.contents : result.contents.affectedEvents;
				notified_messages = result.contents.notifiedMessages;
			}
			driverInsightsAlert.handleEvents(carProbeData.mo_id, (affected_events||[]).concat(notified_messages||[]));

			Q.when(driverInsightsProbe.getProbeData([payload]), function(response){
				var probe = null;
				if(response.contents && response.contents.length > 0){
					// Workaround:
					//   IoT for Automotive service returns probes of multiple vehicle in the area for now
					//   even if the request specifies only one mo_id
					for(var i=0; i<response.contents.length; i++){
						if(response.contents[i].mo_id === payload.mo_id){
							probe = response.contents[i];
							break;
						}
					}
					if(!probe){
						callback("no probe data for " + payload.mo_id);
						return;
					}
					_.extend(payload, probe, {ts: ts});
				}

				// Process alert probe rule
				driverInsightsAlert.evaluateAlertRule(payload);

				// Add notification to response
				payload.notification = {
					affected_events: affected_events || [],
					notified_messages: notified_messages || []
				}

				callback(payload);
			})["catch"](function(err){
				console.error("error: " + JSON.stringify(err));
				callback(err);
			}).done();
		})["catch"](function(err){
			console.error("error: " + JSON.stringify(err));
			callback(err);
		}).done();
	},
	/*
	 * @param carProbeData a JSON array like
	 * [
	 *   {"timestamp":"2014-08-16T08:42:51.000Z","trip_id":"86d50022-45d5-490b-88aa-30b6d286938b","speed":0.0,"mo_id":"DBA-6RCBZ","longitude":139.72317575,"latitude":35.68494402,"heading":90.0},
	 *   {"timestamp":"2014-08-16T08:42:52.000Z","trip_id":"86d50022-45d5-490b-88aa-30b6d286938b","speed":0.0,"mo_id":"DBA-6RCBZ","longitude":139.72317628,"latitude":35.68494884,"heading":360.0}
	 *  ]
	 * @param op sync or async (default is async)
	 */
	sendProbeData: function(carProbeData, op) {
		var deferred = Q.defer();
		var self = this;
		var node = this.vdhConfig;
		var api = "/carProbe";
		
		var url = node.baseURL+api;
		var queryParams = [];
		if (node.tenant_id) {
			queryParams.push('tenant_id='+node.tenant_id);
		}
		if(op === "sync"){
			queryParams.push('op=sync');
		}
		if (queryParams.length > 0) {
			url += ('?' + queryParams.join('&'));
		}
		
		var options = this._addAuthOption(node, {
				method: 'POST',
				url: url,
				headers: {
					'Content-Type':'application/json; charset=UTF-8'
				}
		});
		
		for (var index = 0, len = carProbeData.length; index < len; index++) {
			options.body = JSON.stringify(carProbeData[index]);
			options.headers["Content-Length"] = Buffer.byteLength(options.body);
			debug("sendProbeData(url): " + options.url);
			debug("sendProbeData:" + options.body);
			request(options, function(error, response, body){
				if (!error && response.statusCode === 200) {
					debug('sendProbData response: '+ body);
					self.last_prob_ts = moment().valueOf(); //TODO Need to care in the case that payload.ts is older than last_prob_ts
					try {
						deferred.resolve(JSON.parse(body || "{}"));
					} catch (e) {
						deferred.reject({error: "(sendProbeData)" + body, statusCode: 500});
					}
				} else {
					var statusCode = response ? response.statusCode : 500;
					console.error("sendProbeData:" + options.body);
					console.error('sendProbeData error(' + (response ? response.statusCode : 'no response') + '): '+ error + ': ' + body);
					deferred.reject({error: "(sendProbeData)" + body, statusCode: statusCode});
				}
			});
		}

		return deferred.promise;
	},
	
	/*
	* get probe data with reference probe
	*/ 
	getProbeData: function(carProbeData){
		var deferred = Q.defer();
		var node = this.vdhConfig;
		var api = "/carProbe";
		var url = node.baseURL + api;
		var prefix = '?';
		if (node.tenant_id) {
			url += ('?tenant_id=' + node.tenant_id);
			prefix = '&';
		}
		var options = this._addAuthOption(node, {
				method: "GET",
				url: url
		});
		for(var i = 0; i < carProbeData.length; i++){
			var probe = carProbeData[i];
			options.url += (prefix + "min_longitude=" + (probe.longitude-0.001) +
							"&max_longitude=" + (probe.longitude+0.001) +
							"&min_latitude=" + (probe.latitude-0.001) +
							"&max_latitude=" + (probe.latitude+0.001)) +
							"&mo_id=" + probe.mo_id,
							"driver_id=" +probe.driver_id;
			debug("getProbeData(url): " + options.url);
			request(options, function(error, response, body){
				if(!error && response.statusCode === 200){
					debug("getProbeData response: " + body);
					try {
						deferred.resolve(JSON.parse(body || "{}"));
					} catch (e) {
						deferred.reject({error: "(getProbeData)" + body, statusCode: response.statusCode});
					}
				}else{
					var statusCode = response ? response.statusCode : 500;
					console.error("getProbeData: " + options.body);
					console.error("getProbeData error(" + (response ? response.statusCode : "no response") + "): " + error + ": " + body);
					deferred.reject({error: "(getProbeData)" + body, statusCode: statusCode});
				}
			});
		}
		return deferred.promise;
	},

	/**
	  * @param qs as dict: see https://developer.ibm.com/api/view/id-265:title-IBM_IoT_for_Automotive___Vehicle_Data_Hub#GetCarProbe
		*   - REQURES: min_longitude, max_longitude, min_latitude, max_latitude
		*/
	getCarProbe: function(qs) {
		var deferred = Q.defer();
		var node = this.vdhConfig;
		var api = "/carProbe";
		var options =  this._addAuthOption(node, {
			method: "GET",
			url: node.baseURL + api + "?tenant_id=" + node.tenant_id,
			qs: qs
		});
		debug("getCarProbe(url): " + options.url);
		request(options, function(error, response, body){
			if(!error && response.statusCode === 200){
				debug("getCarProbe response: " + body);
				try {
					var result = JSON.parse(body);
					if(!result.contents){
						console.error("getCarProbe: <contents> is missing in the result.")
					}
					return deferred.resolve(result.contents);
				}catch(e){
					console.error("getCarProbe: Failed to parse JSON: " + body);
					return deferred.reject(e);
				}
			}else{
				var statusCode = response ? response.statusCode : 500;
				console.error("getCarProbe: " + options.body);
				console.error("getCarProbe error(" + (response ? response.statusCode : "no response") + "): " + error + ": " + body);
				deferred.reject({error: "(getCarProbe)" + body, statusCode: statusCode});
			}
		});
		return deferred.promise;
	},
	
	getCarProbeDataListAsDate: function(callback) {
		var deferred = Q.defer();
		
		var node = this.driverInsightsConfig;
		var api = "/datastore/carProbe/dateList";
		var url = node.baseURL + api;
		if (node.tenant_id) {
			url += ("?tenant_id=" + node.tenant_id);
		}
		var options = this._addAuthOption(node, {
				method: 'GET',
				url: url,
				headers: {
//					'Content-Type':'application/json; charset=UTF-8',
				}
		});
		request(options, function(error, response, body){
			if (!error && response.statusCode === 200) {
				callback && callback(body);
				deferred.resolve(body);
			} else {
				console.error('error: '+ body );
				callback && callback("{ \"error(getCarProbeDataListAsDate)\": \"" + body + "\" }");
				deferred.reject(error||body);
			}
		});
		return deferred.promise;
	},
	/**
	 * Create an event in the Context Mapping servie
	 * https://developer.ibm.com/api/view/id-194:title-IBM__Watson_IoT_Context_Mapping#POST/eventservice/event
	 * @param event: a JSON object w/ s_latitude, s_longitude, event_type properties. 
	 * @returns deferred. successful result returns the event ID (integer).
	 */
	createEvent: function(event, op){
		var node = this.vdhConfig;
		var api = "/event";
		
		var url = node.baseURL+api;
		var queryParams = [];
		if (node.tenant_id) {
			queryParams.push('tenant_id='+node.tenant_id);
		}
		if(op === "sync"){
			queryParams.push('op=sync');
		}
		if (queryParams.length > 0) {
			url += ('?' + queryParams.join('&'));
		}
		
		var options = this._addAuthOption(node, {
			method: 'POST',
			url: url,
			headers: {
				'Content-Type':'application/json; charset=UTF-8'
			}
		});
		
		var body = {event: event};
		options.body = JSON.stringify(body);
		options.headers["Content-Length"] = Buffer.byteLength(options.body);

		var deferred = Q.defer();
		debug('Creating a new event: ', options);
		request(options, function(error, response, body){
			if(response && response.statusCode < 300) {
				debug('   Event created: ', body);
				try{
					var responseJson = JSON.parse(body);
					return deferred.resolve(responseJson.contents);
				}catch(e){
					console.error("error on parsing createEvent result\n url: " + options.url + "\n body: " + body);
					return deferred.reject(e);
				}
			}else {
				return deferred.reject(error || response.toJSON());
			}
		});
		return deferred.promise;
	},
	/**
	 * Get events in the VDH service
	 * https://developer.ibm.com/api/view/id-194:title-IBM__Watson_IoT_Context_Mapping#GET/eventservice/event/query
	 * @param min_lat, min_lng, max_lat, max_lng: areas to query
	 * @param event_type: optional
	 * @param status: optional
	 * @returns deferred.
	 */
	getEvent: function(min_lat, min_lng, max_lat, max_lng, event_type, status){
		var queryParams = [];
		queryParams.push("process_type=get");
		queryParams.push("min_latitude=" + min_lat);
		queryParams.push("min_longitude=" + min_lng);
		queryParams.push("max_latitude=" + max_lat);
		queryParams.push("max_longitude=" + max_lng);
		if (event_type) queryParams.push("event_type=" + event_type);
		if (status) queryParams.push("status=" + status);
		return this.getOrQueryEvent(queryParams);
	},
	/**
	 * Query events in the VDH service
	 * @param lat, lng, distance, hedding: areas to query
	 * @param event_type: optional
	 * @param status: optional
	 * @returns deferred.
	 */
	queryEvent: function(lat, lng, distance, heading, event_type, status){
		var queryParams = [];
		queryParams.push("process_type=query");
		queryParams.push("latitude=" + lat);
		queryParams.push("longitude=" + lng);
		queryParams.push("distance=" + distance);
		queryParams.push("heading=" + heading);
		if (event_type) queryParams.push("event_type=" + event_type);
		if (status) queryParams.push("status=" + status);
		return this.getOrQueryEvent(queryParams);
	},
	/**
	 * Get or query events in the VDH service
	 * @returns deferred.
	 */
	getOrQueryEvent: function(queryParams){
		var node = this.vdhConfig;
		var api = "/event";
		var url = node.baseURL+api;
		
		queryParams = queryParams || [];
		if (node.tenant_id) {
			queryParams.push('tenant_id='+node.tenant_id);
		}
		if (queryParams.length > 0) {
			url += ('?' + queryParams.join('&'));
		}

		var options = this._addAuthOption(node, {
			method: 'GET',
			url: url,
			headers: {'Content-Type':'application/json; charset=UTF-8'}
		});

		var deferred = Q.defer();
		request(options, function(error, response, body){
			if(response && response.statusCode < 300) {
				try{
					var responseJson = JSON.parse(body);
					deferred.resolve(responseJson.contents);
				}catch(e){
					deferred.reject(e);
				}
			}else{
				return deferred.reject(error || response.toJSON());
			}
		});
		return deferred.promise;
	},
	
	getLastProbeTime: function(mo_id){
		return lastProbeTimeByMoId[mo_id];
	}
});

// Update last_prob_ts
driverInsightsProbe.getCarProbeDataListAsDate(function(body){
	try{
		var parsed = JSON.parse(body);
		var probeDateList = parsed && parsed.return_code === 0 && parsed.date;
		if(Array.isArray(probeDateList) && probeDateList.length > 0){
			driverInsightsProbe.last_prob_ts = probeDateList.map(function(probeDate){return moment(probeDate).valueOf();}).sort(function(a, b){return b - a;})[0];
		}
	}catch(ex){
		debug(ex);
		// Don't update last_prob_ts
	}
});
