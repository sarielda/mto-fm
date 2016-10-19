/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
var ruleGenerator = module.exports = {};

var _ = require("underscore");
var debug = require('debug')('rule');
debug.log = console.log.bind(console);

var XML_GENERAL_SECTION = "<RuleType>{rule_id}</RuleType>" +
						  	"<RuleID>{rule_type}</RuleID>" +
							"<Name>{name}</Name>" +
							"<Description>{description}</Description>";

/*
 * ruleEngine is an exported module
 */
_.extend(ruleGenerator, {

	createEventIdentifierRuleXML: function(json) {
		return this.createRuleXML("EventIdentifierRule", json);
	},

	createVehicleAcitonRuleXML: function(json) {
		return this.createRuleXML("VehicleActionRule", json);
	},
	
	createRuleXML: function(ruleName, json) {
		var xml = "<" + ruleName + ">";
		xml += this.createGeneralSectionXML(json);
		if (json.target) {
			xml += this.createTargetSectionXML(json.target);
		}
		if (json.condition) {
			xml += this.createConditionSectionXML(json.condition);
		}
		if (json.events) {
			xml += this.createEventsSectionXML(json.events);
		}
		if (json.actions) {
			xml += this.createActionSectionXML(json.actions);
		}
		xml += "</" + ruleName + ">";
		return xml;
	},

	/*
	 * General
	 */
	createGeneralSectionXML: function(json) {
		return XML_GENERAL_SECTION.replace('{rule_id}', json.rule_id||'')
							.replace('{rule_type}', json.rule_type||'')
							.replace('{name}', json.name||'')
							.replace('{description}', json.description||'');
	},
	
	createTargetSectionXML: function(json) {
		var self = this;
		var xml = "<Target>";
		if (json.areas) {
			json.areas.forEach(function(area) {
				xml += self.createTargetAreaSectionXML(area);
			});
		}
		if (json.vehicles) {
			json.vehicles.forEach(function(vehicle) {
				xml += this.createTargetVehicleSectionXML(vehicle);
			});
		}
		if (json.drivers) {
			json.drivers.forEach(function(driver) {
				xml += this.createTargetDriverSectionXML(driver);
			});
		}
		xml += "</Target>";
		return xml;
	},
	/*
	 * Target
	 */
	createTargetAreaSectionXML: function(json) {
		var xml = "<Area>";
		for (var key in json) {
			xml += this._createSimpleXMLNode(key, json[key]);
		}
		xml += "</Area>";
		return xml;
	},
	createTargetVehicleSectionXML: function(json) {
		var xml = "<Vehicle>";
		if (json.types) {
			xml += "<VehicleType>";
			json.vehicle_types.forEach(function(type, index) {
				if (index > 0)
					xml += ",";
				xml += type;
			});
			xml += "</VehicleType>";
		}
		if (json.models) {
			xml += "<VehicleModel>";
			json.vehicle_models.forEach(function(model, index) {
				if (index > 0)
					xml += ",";
				xml += model;
			});
			xml += "</VehicleModel>";
		}

		xml += this._createSimpleXMLNode("VehicleSerialNumber", json.serial_number || "");

		xml += "<VehicleSerialNumber>" + (json.serial_number || "") + "</VehicleSerialNumber>";
		if (json.min_width > 0) {
			xml += this._createSimpleXMLNode("MinVehicleWidth", json.min_width);
		}
		if (json.max_width > 0) {
			xml += this._createSimpleXMLNode("MaxVehicleWidth", json.max_width);
		}
		if (json.min_height > 0) {
			xml += this._createSimpleXMLNode("MinVehicleHeight", json.min_height);
		}
		if (json.max_height > 0) {
			xml += this._createSimpleXMLNode("MaxVehicleHeight", json.max_height);
		}
		xml += "</Vehicle>";
		return xml;
	},
	createTargetDriverSectionXML: function(json) {
		var xml = "<Driver>";
		if (json.min_age > 0) {
			xml += this._createSimpleXMLNode("MinDriverAge", json.min_age);
		}
		if (json.max_age > 0) {
			xml += this._createSimpleXMLNode("MaxDriverAge", json.max_age);
		}
		if (json.license_types) {
			xml += "<LicenseType>";
			json.license_types.forEach(function(type, index) {
				if (index > 0)
					xml += ",";
				xml += type;
			});
			xml += "</LicenseType>";
		}
		if (json.properties) {
			json.properties.forEach(function(prop, index) {
				xml += this._createSimpleXMLNodeWithTagName("Property", prop);
			});
		}
		xml += "</Driver>";
		return xml;
	},
	
	/*
	 * Condition
	 */
	createConditionSectionXML: function(json) {
		var xml = "<Condition pattern=\"" + json.pattern + "\">";
		if (!isNaN(json.count)) {
			xml += this._createSimpleXMLNode("Count", conditionJson.count);
		}
		if (json.value_condition) {
			xml += this._createSimpleXMLNodeWithTagName("ValueCondition", json.value_condition);
		}
		if (json.time_condition) {
			xml += this._createSimpleXMLNode("TimeCondition", json.time_condition.time);
		}
		if (json.location_condition) {
			xml += this.createLocationConditionSectionXML(json.location_condition);
		}
		xml += "</Condition>";
		return xml;
	},
	createLocationConditionSectionXML: function(json) {
		if (json.range) {
			xml = "<LocationCondition range=\"" + json.range + "\">";
		} else {
			xml = "<LocationCondition>";
		}
		for (var key in json) {
			if (key !== "range") {
				xml += this._createSimpleXMLNode(key, json[key]);
			}
		}
		xml += "</LocationCondition>";
		return xml;
	},

	/*
	 * Event
	 */
	createEventsSectionXML: function(json) {
		var xml = "<Events>";
		if (json.events) {
			var self = this;
			json.events.forEach(function(event) {
				xml += "<Event>";
				for (var key in event) {
					xml += self._createSimpleXMLNode(key, event[key]);
				}
				xml += "</Event>";
			});
		}
		xml += "</Events>";
		return xml;
	},
	
	/*
	 * Action
	 */
	createActionSectionXML: function(json) {
		var self = this;
		var xml = "<Action>";
		if (json.vehicle_actions) {
			json.vehicle_actions.forEach(function(action) {
				xml += self.createVehicleActionSectionXML(action);
			});
		}
		xml += "</Action>";
		return xml;
	},
	createVehicleActionSectionXML: function(json) {
		var xml = "<VehicleAction>";
		if (json.message) {
			xml += this._createSimpleXMLNode("Message", json.message);
		}
		if (json.parameters) {
			var self = this;
			json.parameters.forEach(function(parameter) {
				xml += self._createSimpleXMLNodeWithTagName("Parameter", parameter);
			});
		}
		xml += "</VehicleAction>";
		return xml;
	},
	
	_createSimpleXMLNode: function(key, value) {
		var keys = key.split('_');
		var nodeName = "";
		keys.forEach(function(k) {
			if (k.length > 0) {
				nodeName += k.charAt(0).toUpperCase() + k.slice(1);
			}
		});
		return "<" + nodeName + ">" + value + "</" + nodeName + ">";
	},
	_createSimpleXMLNodeWithTagName: function(tag, json) {
		var xml = "";
		for (var key in json) {
			xml += this._createSimpleXMLNode(key, json[key]);
		}
		return this._createSimpleXMLNode(tag, xml);
	}
});