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
 * Generate and get mobile client uuid that is substitute for mobile user id
 */
angular.module('htmlClient')
.factory('mobileClientService', function($q, $timeout, settingsService) {
    return {
		settings: null,
		
		/*
		 * get client uuid
		 */
		getMobileDeviceId: function() {
			var settings = this.getSettings();
			return settings.mobileClientUuid;
		},

		uuid: function() {
			return chance.guid();
		},
		
		/*
		 * add client uuid to http request option. call this for any request that requires authentication
		 */
		makeRequestOption: function(request) {
			if (!request.headers)
				request.headers = {};
			if (request.method && request.method.toLowerCase() === "get")	 {
				request.headers["If-Modified-Since"] = (new Date(0)).toUTCString(); // to avoid IE cache issue
			}
			request.headers["iota-starter-uuid"] = this.getMobileDeviceId();
			if (!request.dataType)
				request.dataType = "json";
			return request;
		},
		
		getSettings: function() {
			if (this.settings)
				return this.settings;
			var settings = settingsService.loadSettings("mobileClientService", {});
			if (!settings.mobileClientUuid) {
				settings.mobileClientUuid = this.uuid();
				this.updateSettings(settings);
			} else {
				this.settings = settings;
			}
			return settings;
		},
		
		updateSettings: function(settings) {
			this.settings = settings;
			settingsService.saveSettings("mobileClientService", settings);
		}
	};
})
;