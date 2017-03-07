/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var os = require('os');
var url = require('url');
var request = require("request");
var cfenv = require('cfenv');
var sdk = require('bluemix-secure-gateway');

var pool = {maxSockets: 10};

/**
 * Hook request(opt, callback) for calling services via the secure gateway
 * 
 * - add connection pool for keep-alive connection
 * - add "host" header by parsing the request url
 */
var requestEx = function(opts, callback){
	if(typeof opts === 'string'){
		opts = {url: opts};
	}
	// ensure connection pool
	if(typeof opts.pool === 'undefined'){
		opts.pool = pool;
	}
	// ensure Host header
	opts.headers = opts.headers || {};
	var parsed = url.parse(opts.url || opts.uri);
	
	if(!opts.headers.Host){
		opts.headers.Host = parsed.hostname + (parsed.port ? ':' + parsed.port : '');
	}
	
	return request(opts, callback);
};

var GW_ID_ENV_KEY = 'SECURE_GW_IPTABLE_CFG_GW_ID';
var GW_TOKEN_ENV_KEY = 'SECURE_GW_IPTABLE_CFG_GW_TOKEN';
var GW_DEST_ID_ENV_KEY = 'SECURE_GW_IPTABLE_CFG_DEST_IDS';
/**
 * Add this app instance (CF_INSTANCE_IP) to the secure gateway IP table
 *
 * - SECURE_GW_IPTABLE_CFG_GW_IDn : the ID of the gateway whose ip-table is configured, where n is integer or ''
 * - SECURE_GW_IPTABLE_CFG_GW_TOKENn : the key fo the gateway
 * - SECURE_GW_IPTABLE_CFG_DEST_IDSn : the comma-separated list of the destination IDs
 * 
 * To configure IP tables, call `require('./driverInsights/requestEx.js').configureIPTableRule();`
 */
requestEx.configureIPTableRule = function(){
	var appEnv = cfenv.getAppEnv();
	
	// the key used to destinguish an ip talbe entry for this app instance
	var appId = appEnv.app.application_id ? appEnv.app.application_id + (process.env.CF_INSTANCE_INDEX || '') : os.hostname(); 
	//var appId = process.env.CF_INSTANCE_IP + (process.env.CF_INSTANCE_INDEX || ''); //appEnv.app.application_id || os.hostname(); 
	var appIp = process.env.CF_INSTANCE_IP;
	
	// extract {id:[gw id], securityToken:[gw security token], destIDs:[list of dest_id]}
	var gwConfigs = Object.keys(process.env).filter(function(key){
		return key.indexOf(GW_ID_ENV_KEY) === 0;
	}).map(function(key){
		// extract settings from env for a gw key
		var n = key.substring(GW_ID_ENV_KEY.length);
		var gwid = process.env[GW_ID_ENV_KEY + n];
		var gwSecurityToken = process.env[GW_TOKEN_ENV_KEY + n];
		var destIds = process.env[GW_DEST_ID_ENV_KEY + n];
		destIds = destIds && destIds.split(',').filter(function(id){ return !!id.trim(); });
		
		console.log('Configuring Secure Gateway gateway_id [%s] for app id [%s]...', gwid, appId);
		if(!gwSecurityToken){
			console.error('  ERROR: Missing security token ENV [%s] for gateway id [%s]', GW_TOKEN_ENV_KEY + n, gwid);
		}
		if(!destIds || destIds.length === 0){
			console.error('  ERROR: Missing destination ids ENV [%s] for gateway id [%s]', GW_DEST_ID_ENV_KEY + n, gwid);
		}
		if(!gwSecurityToken || !destIds || destIds.length === 0){
			throw new Error();
		}
		return {id: gwid, securityToken: gwSecurityToken, destIds: destIds };
	});
	if(gwConfigs.length == 0)
		return; // do nothing
	
	// work with teh bluemix-secure-gateway APIs and modify iptable
	var sgCreds = appEnv.services['SecureGateway'][0];
	var sgEnv = sdk.defaults({
		basepath: sgCreds && sgCreds.credentials && sgCreds.credentials.url || process.env.SECURE_GW_URL,
		orgID: sgCreds && sgCreds.org_id,
		spaceID: sgCreds && sgCreds.space_id,
	});
	gwConfigs.forEach(function(config){
		if(!config) return;
		var gateway = sgEnv.getGateway({id: config.id, securityToken: config.securityToken}, function(err, gateway){
			if(err){
				throw new Error('Failed to get gateway [' + config.id + ']: ' + err);
			}
			config.destIds.forEach(function(destId){
				console.log('Adding ip [%s] to iptable [%s] in gateway [%s]...', appIp, destId, config.id);
				gateway.addIPTableRule(destId, {src: appIp, app: appId}, function(err){
					if(err){
						var msg = ('Failed to modify iptable of destination [' + destId + '] in gateway [' + config.id + ']: ' +  err);
						if(appEnv.isLocal){
							console.warn('Error on modifying iptable, which probably ignoreable for destination configured for testing.');
							console.warn('  Skipping. Message: ' + msg);
							return;
						}
						throw new Error(msg);
					}
					console.log('Done modifying iptable [%s] for ip [%s]', destId, appIp);
					if(appEnv.isLocal){
						console.warn('WARNGING');
						console.warn('WARNGING == This app is running locall and iptable modification may not work ==');
						console.warn('WARNGING -- Be aware that IP address used to access the secure gateway');
						console.warn('WARNGING -- can be changed depending on the network configuration.');
						console.warn('WARNGING');
					}
				});
			});
		});
	});
};

module.exports = requestEx;
