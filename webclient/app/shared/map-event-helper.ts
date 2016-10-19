/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import * as ol from "openlayers";
import { Injectable } from "@angular/core";
import { EventService } from "./iota-event.service";
import{ MapItemHelper } from "./map-item-helper";
import{ Item } from "./map-item-helper";

@Injectable()
export class MapEventHelper extends MapItemHelper<Event> {
  dirs: string[];
  eventTypes = [];
  eventIcon = null;
  styles: ol.style.Style[];
  affectedStyles: ol.style.Style[];
  defaultStyle: ol.style.Style;

  constructor(public map: ol.Map, public itemLayer: ol.layer.Vector, public eventService: EventService, options: any = {}) {
    super(map, itemLayer);

    options = options || {};
    this.setItemLabel(options.itemLabel || "Event");

    let self = this;
    let getFeatureStyle = function getFeatureStyle(feature: ol.Feature) {
      let eventIcon = new ol.style.Circle({
          radius: 10,
          stroke : new ol.style.Stroke({
            color: "#ffc000",
            width: 1
          }),
          fill : new ol.style.Fill({
            color: "yellow"
          })
        });
      let affectedEventIcon = new ol.style.Circle({
          radius: 10,
          stroke : new ol.style.Stroke({
            color: "yellow",
            width: 3
          }),
          fill : new ol.style.Fill({
            color: "#ffc000"
          })
        });
        let tentativeIcon = new ol.style.Circle({
            radius: 10,
            stroke : new ol.style.Stroke({
              color: "#ffc000",
              width: 1,
              lineDash: [3, 3]
            }),
            fill : new ol.style.Fill({
              color: "rgba(240,240,0,0.7)"
            })
          });
      self.defaultStyle = new ol.style.Style({image: tentativeIcon});

      let arrowTexts = ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"];
      self.styles = arrowTexts.map(function(text) {
        let rotation = 0; // 3.14 * rotation / 180;
        return new ol.style.Style({
            image: eventIcon,
            text: new ol.style.Text({
                fill: new ol.style.Fill({color: "#606060"}),
                scale: 1.0,
                textAlign: "center",
                textBaseline: "middle",
                text: text,
                rotation: rotation,
                font: "16px monospace"
            })
          });
      });
      self.affectedStyles = arrowTexts.map(function(text) {
        let rotation = 0; // 3.14 * rotation / 180;
        return new ol.style.Style({
            image: affectedEventIcon,
            text: new ol.style.Text({
                fill: new ol.style.Fill({color: "#404040"}),
                scale: 1.0,
                textAlign: "center",
                textBaseline: "middle",
                text: text,
                rotation: rotation,
                font: "16px monospace"
            })
          });
      });

      return function(feature, resolution) {
        let style = self.getFeatureStyle(feature);
        feature.setStyle(style);
        return style;
      };
    }(undefined);
    this.itemLayer.setStyle(getFeatureStyle);
    this.eventService.getEventTypes().subscribe(data => { this.eventTypes = data; });
  }

  getFeatureStyle(feature: ol.Feature) {
    let event = feature.get("item");
    if (!event) {
      return this.defaultStyle;
    }
    let textIndex = Math.floor((event.heading % 360) / Math.floor(360 / this.styles.length));
    let rotation = (event.heading % 360) % Math.floor(360 / this.styles.length);
    if (rotation > Math.floor(360 / this.styles.length) / 2) {
      textIndex++;
      if (textIndex === this.styles.length)
      textIndex = 0;
    }
    let affected = feature.get("affected");
    return affected ? this.affectedStyles[textIndex] : this.styles[textIndex];
  };

  public getItemType() {
    return "event";
  }

  // query items within given area
  public queryItems(min_longitude: number, min_latitude: number, max_longitude: number, max_latitude: number) {
    return this.eventService.queryEvents({
        min_latitude: min_latitude,
        min_longitude: min_longitude,
        max_latitude: max_latitude,
        max_longitude: max_longitude
    }).map(data => {
      return data.map(function(event) {
        return new Event(event);
      });
    });
  }

  // query items within given area
  public getItem(id: string) {
    return this.eventService.getEvent(id).map(data => {
      return new Event(data);
    });
  }

  public createItemFeatures(event: Event) {
    // Setup current event position
    let coordinates: ol.Coordinate = [event.s_longitude || 0, event.s_latitude || 0];
    let position = ol.proj.fromLonLat(coordinates, undefined);
    let feature = new ol.Feature({geometry: new ol.geom.Point(position), item: event});
    console.log("created an event feature : " + event.event_id);
    return [feature];
  }

  public createTentativeFeatures(loc: any) {
    // Setup current event position
    let position = ol.proj.fromLonLat([loc.longitude, loc.latitude], undefined);
    let feature = new ol.Feature({geometry: new ol.geom.Point(position)});
    return [feature];
  }

  public createItem(param: any) {
    return new Event(param);
  }

  public getHoverProps(event: Event) {
    let eventTypes =   this.eventTypes || [];
    // event type or description
    let description = event.event_type;
    for (let i = 0; i < eventTypes.length; i++) {
      let type = eventTypes[i];
      if (type.event_type === event.event_type) {
        description = type.description;
        break;
      }
    }

    let props = [];
    if (description) {
      props.push({key: "type", value: description});
    }
    // location and heading
    let index = Math.floor(((event.heading / 360 + 1 / 32) % 1) * 16);
    let dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
    let dir = dirs[index];
    props.push({key: "location", value: Math.round(event.s_latitude * 10000000) / 10000000 + "," + Math.round(event.s_longitude * 10000000) / 10000000});
    props.push({key: "heading", value: Math.round(event.heading * 10000000) / 10000000 + " [" + dir + "]"});
    return props;
  }
}

export class Event extends Item {
  event_id: string;
  event_type: string;
  event_name: string;
  event_category: string;
  s_longitude: number;
  s_latitude: number;
  heading: number;

  constructor(params) {
    super(params);
  }

  public getId() {
    return this.event_id ? this.event_id.toString() : null;
  }
  public getItemType() {
    return "event";
  }
}
