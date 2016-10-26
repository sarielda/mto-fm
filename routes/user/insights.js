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
 * REST APIs using Driver Behavior service as backend
 */
var Q = require('q');
var _ = require('underscore');
var WebSocketServer = require('ws').Server;
var appEnv = require("cfenv").getAppEnv();

var router = module.exports = require('express').Router();
var authenticate = require('./auth.js').authenticate;
var driverInsightsProbe = require('../../driverInsights/probe');
var driverInsightsContextMapping = require('../../driverInsights/contextMapping');
var driverInsightsAlert = require('../../driverInsights/fleetalert.js');
var dbClient = require('../../cloudantHelper.js');

var debug = require('debug')('monitoring:cars');
debug.log = console.log.bind(console);

function handleAssetError(res, err) {
	//{message: msg, error: error, response: response}
	console.error('error: ' + JSON.stringify(err));
	var status = (err && (err.status||err.statusCode)) || 500;
	var message = err.message || (err.data && err.data.message) || err;
	return res.status(status).send(message);
}

router.post('/probeData',  authenticate, function(req, res) {
	try{
		driverInsightsProbe.sendRawData(req.body, function(msg){
			if (msg.statusCode) {
				res.status(msg.statusCode).send(msg);
			} else {
				res.send(msg);
			}
		});
	}catch(error){
		handleAssetError(res, error);
	}
});

router.get('/probeData',  authenticate, function(req, res) {
	driverInsightsProbe.getCarProbeDataListAsDate().then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

/**
 * Examples:
 *  List all the cars
 *   http://localhost:6003/monitoring/cars/query?min_lat=-90&max_lat=90&min_lng=-180&max_lng=180
 */
router.get('/carProbe', authenticate, function(req, res) {
	// get extent
	var extent = normalizeExtent(req.query);
	if ([extent.max_lat, extent.max_lng, extent.min_lat, extent.min_lng].some(function(v){ return isNaN(v); })){
		return res.status(400).send('One or more of the parameters are undefined or not a number'); // FIXME response code
	}
	// query by extent
	var qs = {
		min_longitude: extent.min_lng,
		min_latitude: extent.min_lat,
		max_longitude: extent.max_lng,
		max_latitude: extent.max_lat,
	};
	// add vehicleId query
	if(req.query.vehicleId){
		qs.mo_id = req.query.vehicleId;
	}

	// initialize WSS server
	var wssUrl = req.baseUrl + req.route.path;
	if (!req.app.server) {
		console.error('failed to create WebSocketServer due to missing app.server');
		res.status(500).send('Filed to start wss server in the insights router.')
	} else {
		initWebSocketServer(req.app.server, wssUrl);
	}

	getCarProbe(qs, true).then(function(probes){
		// send normal response
		var ts = _.max(_.map(probes, function(d){ return d.lastEventTime || d.t || d.ts; }));
		res.send({
			count: probes.length,
			devices: probes,
			serverTime: (isNaN(ts) || !isFinite(ts)) ? Date.now() : ts,
			wssPath: wssUrl + '?' + "region=" + encodeURI(JSON.stringify(extent))
		});
	})["catch"](function(error){
		res.send(error);
	}).done();
});

router.get('/carProbeMonitor', authenticate, function(req, res) {
	var qs = req.url.substring('/carProbeMonitor?'.length);
	res.render('carProbeMonitor', { appName: appEnv.name, qs: qs });
});

router.get("/routesearch", function(req, res){
	var q = req.query;
	driverInsightsContextMapping.routeSearch(
		q.orig_latitude,
		q.orig_longitude,
		q.orig_heading || 0,
		q.dest_latitude,
		q.dest_longitude,
		q.dest_heading || 0,
		q.option
	).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

router.get("/alert", function(req, res){
	var q = req.query;
	var conditions = [];
	if(q.type){
		conditions.push("type:" + q.type);
	}
	if(q.severity){
		conditions.push("severity:" + q.severity);
	}
	if(q.mo_id){
		conditions.push("mo_id:" + q.mo_id);
	}
	var includeClosed = q.includeClosed === "true";
	var limit = q.limit;

	var extent = normalizeExtent(q);
	var extentAsArray = [extent.max_lat, extent.max_lng, extent.min_lat, extent.min_lng];
	if (extentAsArray.every(function(v){ return isNaN(v); })){
		Q.when(driverInsightsAlert.getAlerts(conditions, includeClosed, limit), function(docs){
			res.send(docs);
		});
	}else if(extentAsArray.every(function(v){ return !isNaN(v); })){
		var qs = {
				min_longitude: extent.min_lng,
				min_latitude: extent.min_lat,
				max_longitude: extent.max_lng,
				max_latitude: extent.max_lat,
			};
		Q.when(driverInsightsAlert.getAlertsForVehicleInArea(conditions, qs, includeClosed, limit), function(docs){
			res.send(docs);
		});
	}else if(extentAsArray.some(function(v){ return isNaN(v); })){
		res.status(400).send('One or more of the parameters are undefined or not a number')
	}
});

router.get("/event/query", function(req, res){
	var q = req.query;
	driverInsightsContextMapping.queryEvent(
		q.min_latitude,
		q.min_longitude,
		q.max_latitude,
		q.max_longitude,
		q.event_type,
		q.status
	).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

router.get("/event", function(req, res){
	var q = req.params.event_id;
	driverInsightsContextMapping.getEvent(req.query.event_id).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

router.post("/event", function(req, res){
	driverInsightsProbe.createEvent(req.body, "sync").then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

router["delete"]("/event", function(req, res){
	driverInsightsContextMapping.deleteEvent(req.query.event_id).then(function(msg){
		res.send(msg);
	})["catch"](function(error){
		handleAssetError(res, error);
	});
});

/*
 * Shared WebSocket server instance
 */
router.wsServer = null;

/*
 * Create WebSocket server
 */
var initWebSocketServer = function(server, path){
	if (router.wsServer !== null){
		return; // already created
	}

	var TIMEOUT = 1000;
	var timerWebSockEmitFunc = function() {
		//
		// This is invoked every TIMEOUT milliseconds to send the latest car probes to server
		//
		Q.allSettled(router.wsServer.clients.map(function(client){
			function getQs(){
				var e = client.extent;
				if(e){
					return {
						min_latitude: e.min_lat, min_longitude: e.min_lng,
						max_latitude: e.max_lat, max_longitude: e.max_lng
					};
				}
				return { min_latitude: -90, min_longitude: -180,
						 max_latitude:  90, max_longitude:  180 };
			}
			return getCarProbe(getQs(), true).then(function(probes){
				probes = probes || [];
				// construct message
				var msgs = JSON.stringify({
					count: (probes.length),
					devices: (probes),
					deleted: undefined,
				});
				try {
					client.send(msgs);
					debug('  sent WSS message. ' + msgs);
				} catch (e) {
					console.error('Failed to send wss message: ', e);
				}
			})['catch'](function(err){
				console.error('Failed to get car probe', err);
			});
		})).done(function(){
			// re-schedule once all the wss.send has been completed
			setTimeout(timerWebSockEmitFunc, TIMEOUT);
		});
	};
	setTimeout(timerWebSockEmitFunc, TIMEOUT);

	//
	// Create WebSocket server
	//
	var wss = router.wsServer = new WebSocketServer({
		server: server,
		path: path,
		verifyClient : function (info, callback) { //only allow internal clients from the server origin
			var isLocal = appEnv.url.toLowerCase().indexOf('://localhost') !== -1;
			var allow = isLocal || (info.origin.toLowerCase() === appEnv.url.toLowerCase());
			if(!allow){
				console.error("rejected web socket connection form external origin " + info.origin + " only connection form internal origin " + appEnv.url + " are accepted");
			}
			if(!callback){
				return allow;
			}
			var statusCode = (allow) ? 200 : 403;
			callback (allow, statusCode);
		}
	});

	//
	// Assign "extent" to the client for each connection
	//
	wss.on('connection', function(client){
		debug('got wss connectoin at: ' + client.upgradeReq.url);
		// assign extent obtained from the web sock request URL, to this client
		var url = client.upgradeReq.url;
		var qsIndex = url.lastIndexOf('?region=');
		if(qsIndex >= 0){
			try{
				var j = decodeURI(url.substr(qsIndex + 8)); // 8 is length of "?region="
				var extent = JSON.parse(j);
				client.extent = normalizeExtent(extent);
			}catch(e){
				console.error('Error on parsing extent in wss URL', e);
			}
		}
	});
}

function getCarProbe(qs, addAlerts){
	var probes = Q(driverInsightsProbe.getCarProbe(qs).then(function(probes){
		// send normal response
		(probes||[]).forEach(function(p){
			if(p.timestamp){
				p.ts = Date.parse(p.timestamp);
				p.deviceID = p.mo_id;
			}
		});
		return probes;
	}));
	if(addAlerts) {
		probes = Q(probes.then(function(probes){
			if(!probes || probes.length == 0)
				return probes;
			var conditions = [];
			var mo_id_condition = "(" + probes.map(function(probe){
				return "mo_id:"+probe.mo_id;
			}).join(" OR ") + ")";
			conditions.push(mo_id_condition);
			return driverInsightsAlert.getAlerts(conditions, /*includeClosed*/false, 200).then(function(result){
				// result: { alerts: [ { closed_ts: n, description: s, mo_id: s, severity: s, timestamp: s, ts: n, type: s }, ...] }
				var alertsByMoId = _.groupBy(result.alerts || [], function(alert){ return alert.mo_id; });
				probes.forEach(function(probe){
					var alertsForMo = alertsByMoId[probe.mo_id] || {}; // lookup
					if(alertsForMo){ // list of alerts
						var alertCounts = _.countBy(alertsForMo, function(alert){
							return alert.severity;
						});
						alertCounts.items = alertsForMo; // details if needed
						
						// calculate summary
						var alertsByType = _.groupBy(alertsForMo, function(alert) { return alert.type; });
						// severity: High: 100, Medium: 10, Low: 1, None: 0 for now
						var severityByType = _.mapObject(alertsByType, function(alerts, type){
							if(alerts && alerts.length === 0) return undefined;
							return _.max(alerts, function(alert){
								var s = alerts.severity && alerts.severity.toLowerCase();
								return s === 'high' ? 100 : (s === 'medium' ? 10 : (s === 'low' ? 1 : 0));
							}).severity;
						});
						alertCounts.byType = severityByType;
						//
						probe.info = _.extend(probe.info || {}, { alerts: alertCounts }); // inject alert counts
					}
				})
				return probes;
			});
		}));
	}
	return probes;
}


function normalizeExtent(min_lat_or_extent, min_lng, max_lat, max_lng){
	// convert one when the object is passed
	var min_lat;
	if(min_lat_or_extent && min_lat_or_extent.min_lat){
		var e = min_lat_or_extent;
		min_lat = e.min_lat;
		min_lng = e.min_lng;
		max_lat = e.max_lat;
		max_lng = e.max_lng;
	}else{
		min_lat = min_lat_or_extent;
	}

	// to float
	min_lat = parseFloat(min_lat);
	min_lng = parseFloat(min_lng);
	max_lat = parseFloat(max_lat);
	max_lng = parseFloat(max_lng);

	// normalize
	var whole_lng = ((max_lng - min_lng) > 359.9);
	min_lng = whole_lng ? -180 : ((min_lng + 180) % 360) - 180;
	max_lng = whole_lng ?  180 : ((max_lng + 180) % 360) - 180;
	var extent = {min_lng: min_lng, min_lat: min_lat, max_lng: max_lng, max_lat: max_lat, whole_lng: whole_lng};

	return extent;
}
