/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */

var _ = require("underscore");
var Q = new require('q');

function queue() {
	this.queue = [];
	this.running = false;
}

queue.prototype.push = function(request) {
	this.queue.push(request);
	if (!this.running && this.queue.length === 1) {
		this._run();
	}
};

queue.prototype.clear = function(request) {
	_.each(this.queue, function(request) {
		request.canceled && request.canceled();
	});
	this.queue = [];
};

queue.prototype._run = function() {
	if (this.queue.length === 0) {
		return;
	}
	
	var self = this;
	this.running = true;
	var request = this.queue.shift();
	Q.when(request.run(request.params), function(result) {
		try {
			request.done && request.done(result);
		} finally {
			self._next();
		}
	})["catch"](function(error) {
		try {
			request.error && request.error(error);
		} finally {
			self._next();
		}
	});
};

queue.prototype._next = function() {
	this.running = false;
	if (this.queue.length === 0) {
		return;
	}
	var self = this;
	setTimeout(function() {
		self._run();
	}, 10);
};


module.exports = queue;
