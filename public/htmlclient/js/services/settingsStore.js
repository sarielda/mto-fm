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
 * Save and load setting values
 */
angular.module('htmlClient')
.factory('settingsService', function($q, $timeout) {
	return {
		category: "iot_auto_settings",
		settingsCache: {},
		loadSettings: function(componentName, defaultValues) {
			if (!componentName)
				return null;
			
			if (this.settingsCache[componentName]) {
				return this.settingsCache[componentName];
			}
			
	        var settings = $.cookie(this.category + '.' + componentName);
	        if (settings) {
	        	try {
	            	settings = JSON.parse(settings);
	        	} catch(e) {
					console.error(e);
	        	}
	        }
            settings = _.extend({}, defaultValues, settings||{});
	        this.settingsCache[componentName] = settings;
	        return settings;
		},
    
	    saveSettings: function(componentName, settings, expires) {
			if (!componentName)
				return;
	        this.settingsCache[componentName] = settings;
	        if (!expires) expires = 365 * 20;
	        $.cookie(this.category + '.' + componentName, settings ? JSON.stringify(settings) : null, {expires: expires});
	    }
	};
})
;