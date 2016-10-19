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
 * Provides authorization router and function
 * Exports: router: Router
 *          authenticate: Authenticate function
 */
var fs = require('fs-extra');
var path = require('path');
var _ = require('underscore');

var router = module.exports.router = require('express').Router();
var basicAuth = require('basic-auth');
var appEnv = require("cfenv").getAppEnv();

var APP_USER = process.env.APP_USER || "starter";
var APP_PASSWORD = process.env.APP_PASSWORD || "Starter4Iot";

//basic authentication
var authenticate = function(req,res,next){
	if(APP_USER === 'none' && APP_PASSWORD === "none")
		return next();
	function unauthorized(res) {
		res.set('WWW-Authenticate', 'Basic realm=Authorization Required. Find README.md for the user name and password');
		return res.status(401).end();
	}
	var user = basicAuth(req);
	if (!user || !user.name || !user.pass) {
		return unauthorized(res);
	}
	if (user.name === APP_USER && user.pass === APP_PASSWORD) {
		return next();
	} else {
		return unauthorized(res);
	}
};

var eula = function(req,res,next){
	if(req.cookies.eulaStatus === 'Accepted')
		return next();
	if(!req.accepts('html') || req.xhr)
		return next();
	fs.readFile(path.join(__dirname, '../../LICENSE'), 'ascii', function(err, license){
		if(err) return res.status(500).send(err);
		license = '<p>' + _.escape('' + license).split('\n').join('</p>\n<p>') + '</p>';
		res.render('eula', {license: license});
	});
}

module.exports.router = router;
module.exports.authenticate = authenticate; // export the authentication router
module.exports.eula = eula; // export the eula middleware

