/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
VCAP_SERVICES = JSON.parse(process.env.VCAP_SERVICES || '{}')

/**
 * Module dependencies.
 */
var express = require('express')
  , auth = require('./routes/user/auth.js')
  , user = require('./routes/user')
  , http = require('http')
  , cors = require('cors')
  , path = require('path')
  , fs = require('fs-extra')
  , helmet = require('helmet')
  , logger = require('morgan')
  , cookieParser = require('cookie-parser')
  , bodyParser = require('body-parser')
  , methodOverride = require('method-override');
var appEnv = require("cfenv").getAppEnv();

//Deployment tracker code snippet
require("cf-deployment-tracker-client").track();

var app = express();

// all environments
app.set('port', appEnv.port || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.enable('trust proxy');
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(methodOverride());
app.use(helmet());
app.use(cors());

//force https for all requests
app.use(function (req, res, next) {
	if(req.headers['x-forwarded-proto'] && req.headers['x-forwarded-proto'] === 'http'){
		res.redirect('https://' + req.headers.host + req.url);
	} else{
		next();
	}
});

//basic authentication to all routes
app.use(auth.authenticate);
//mandate eula acceptance
app.use(auth.eula);

//access to server contents
app.use(express.static(path.join(__dirname, 'public')));
app.use('/user', user);

var webClientModulePath = 'webclient';
var webClientTop = path.join(__dirname, webClientModulePath + '/index.html');
if ('development' === app.get('env')){
	console.log('Settig up the webclient for DEVELOPMENT mode..., which uses all the resources under webclient');
	// add the base path
	app.use('/webclient', express.static(path.join(__dirname, 'webclient')));
}else{
	console.log('Settig up the webclient for NON-DEVELOPMENT mode...');
	webClientTop = path.join(__dirname, webClientModulePath + '/dist/index.html');
	app.use('/webclient', express.static(path.join(__dirname, webClientModulePath + '/dist')));
	app.use('/webclient', express.static(path.join(__dirname, webClientModulePath)));
}
app.get('/webclient/map*', function (req, res) { res.status(200).sendFile(webClientTop); });
app.get('/webclient/carStatus*', function (req, res) { res.status(200).sendFile(webClientTop); });
app.get('/webclient/alert*', function (req, res) { res.status(200).sendFile(webClientTop); });
app.get('/webclient/users*', function (req, res) { res.status(200).sendFile(webClientTop); });
app.get('/webclient/vehicle*', function (req, res) { res.status(200).sendFile(webClientTop); });
app.get('/webclient/tool*', function (req, res) { res.status(200).sendFile(webClientTop); });

// development only
if ('development' === app.get('env')) {
	app.use(function(req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});
}

app.server = http.createServer(app);
app.server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});
