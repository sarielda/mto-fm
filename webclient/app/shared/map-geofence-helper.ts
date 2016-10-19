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
import { GeofenceService } from "./iota-geofence.service";
import{ MapItemHelper } from "./map-item-helper";
import{ Item } from "./map-item-helper";

@Injectable()
export class MapGeofenceHelper extends MapItemHelper<Geofence> {
  targetStyle: ol.style.Style;
  geometryBorderStyle: ol.style.Style;
  tentativeStyle: ol.style.Style;
  AREA_MARGIN = 1000; // 1000 m
  constructor(public map: ol.Map, public itemLayer: ol.layer.Vector, public geofenceService: GeofenceService, options: any = {}) {
    super(map, itemLayer);

    options = options || {};
    this.setItemLabel(options.itemLabel || "Geofence");

    let self = this;
    let getFeatureStyle = function getFeatureStyle(feature: ol.Feature) {
      self.targetStyle = new ol.style.Style({
          fill: new ol.style.Fill({
            color: [255, 0, 128, 0.1]
          })
      });
      self.geometryBorderStyle = new ol.style.Style({
          stroke: new ol.style.Stroke({
            color: [255, 0, 128, 0.3],
            width: 2
          })
      });
      self.tentativeStyle = new ol.style.Style({
          fill: new ol.style.Fill({
            color: [100, 0, 100, 0.05]
          }),
          stroke: new ol.style.Stroke({
            color: [100, 0, 100, 0.3],
            width: 2,
            lineDash: [5, 5]
          })
      });

      return function(feature, resolution) {
        let style = self.getFeatureStyle(feature);
        if (style) {
          feature.setStyle(style);
        }
        return style;
      };
    }(undefined);
    this.itemLayer.setStyle(getFeatureStyle);

    this.featureExtension = options.editable && <any>function() {
      let handleStyle = new ol.style.Style({
        text: new ol.style.Text({
            fill: new ol.style.Fill({color: "#404040"}),
            scale: 1.0,
            textAlign: "center",
            textBaseline: "middle",
            text: "\u25cf",
            font: "18px monospace"
        })
      });
      return {
        decorate: function(item: any, features: ol.Feature[]) {
          if (item.geometry) {
            let areaFeature = null;
            let _this = this;
            _.each(features, function(feature) {
              if (feature.get("border")) {

                let handles: ol.Feature[] = [];

                // Constraint for rectangle geofence
                let rectangleConstraint = function rectangleConstraint(handle, point, deltaX, deltaY) {
                  let index = this.index;

                  // create new geometry
                  let itemGeometry = item.geometry;
                  let p = ol.proj.toLonLat(point, undefined);
                  let newGeometry = {min_longitude: itemGeometry.min_longitude,
                                    min_latitude: itemGeometry.min_latitude,
                                    max_longitude: itemGeometry.max_longitude,
                                    max_latitude: itemGeometry.max_latitude};
                  if (index === 0) {
                    newGeometry.min_longitude = p[0];
                    newGeometry.min_latitude = p[1];
                  } else if (index === 1) {
                    newGeometry.min_longitude = p[0];
                    newGeometry.max_latitude = p[1];
                  } else if (index === 2) {
                    newGeometry.max_longitude = p[0];
                    newGeometry.max_latitude = p[1];
                  } else if (index === 3) {
                    newGeometry.max_longitude = p[0];
                    newGeometry.min_latitude = p[1];
                  }

                  // update coordinates of item feature
                  let itemFeature = feature.get("decorates");
                  let targetArea = self.createTargetArea(item.geometry_type, newGeometry, item.direction);
                  let polygon = self.createPolygonFeature(item.geometry_type, newGeometry, targetArea, item.direction);
                  itemFeature.getGeometry().setCoordinates(polygon.getCoordinates());

                  // update coordinates of border
                  let polygonCoordinates = self.createGeofenceCoordinate(newGeometry, item.geometry_type);
                  (<any>feature.getGeometry()).setCoordinates([polygonCoordinates]);

                  // update coordinates of handles
                  let handlePoints = [];
                  handlePoints.push(ol.proj.fromLonLat([newGeometry.min_longitude, newGeometry.min_latitude], undefined));
                  handlePoints.push(ol.proj.fromLonLat([newGeometry.min_longitude, newGeometry.max_latitude], undefined));
                  handlePoints.push(ol.proj.fromLonLat([newGeometry.max_longitude, newGeometry.max_latitude], undefined));
                  handlePoints.push(ol.proj.fromLonLat([newGeometry.max_longitude, newGeometry.min_latitude], undefined));
                  _.each(handles, function(handle, i) {
                    (<any>handle.getGeometry()).setCoordinates(handlePoints[i]);
                  });
                };

                // Constraint for circle geofence
                let circleConstraint = function circleConstraint(handle, point, deltaX, deltaY) {
                  let index = this.index;

                  // create new geometry
                  let itemGeometry = item.geometry;

                  let centerLonLat = [itemGeometry.longitude, itemGeometry.latitude];
                  let handleLonLat = ol.proj.toLonLat(point, undefined);

                  let dx = self.calcDistance([handleLonLat[0], centerLonLat[1]], centerLonLat);
                  let dy = self.calcDistance([centerLonLat[0], handleLonLat[1]], centerLonLat);

                  // Update radius of curcle feature
                  let new_radius = Math.min(dx, dy);
                  let newGeometry = {longitude: itemGeometry.longitude,
                                    latitude: itemGeometry.latitude,
                                    radius: new_radius};


                  // update coordinates of item feature
                  let itemFeature = feature.get("decorates");
                  let targetArea = self.createTargetArea(item.geometry_type, newGeometry, item.direction);
                  let polygon = self.createPolygonFeature(item.geometry_type, newGeometry, targetArea, item.direction);
                  itemFeature.getGeometry().setCoordinates(polygon.getCoordinates());

                  // update coordinates of border
                  let polygonCoordinates = self.createGeofenceCoordinate(newGeometry, item.geometry_type);
                  (<any>feature.getGeometry()).setCoordinates([polygonCoordinates]);

                  // update coordinates of handles
                  let handlePoints = [];
                  let min_x = self.calcPosition(centerLonLat, new_radius, 270)[0];
                  let min_y = self.calcPosition(centerLonLat, new_radius, 180)[1];
                  let max_x = self.calcPosition(centerLonLat, new_radius, 90)[0];
                  let max_y = self.calcPosition(centerLonLat, new_radius, 0)[1];
                  handlePoints.push(ol.proj.fromLonLat([min_x, min_y], undefined));
                  handlePoints.push(ol.proj.fromLonLat([min_x, max_y], undefined));
                  handlePoints.push(ol.proj.fromLonLat([max_x, max_y], undefined));
                  handlePoints.push(ol.proj.fromLonLat([max_x, min_y], undefined));
                  _.each(handles, function(handle, i) {
                    (<any>handle.getGeometry()).setCoordinates(handlePoints[i]);
                  });
                };

                // Show handles on each corner
                let geometry = item.geometry;
                let points: ol.Coordinate[] = [];
                let constraint = null;
                if (item.geometry_type === "circle") {
                  let min_x = self.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 270)[0];
                  let max_x = self.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 90)[0];
                  let max_y = self.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 0)[1];
                  let min_y = self.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 180)[1];
                  points.push(ol.proj.fromLonLat([min_x, min_y], undefined));
                  points.push(ol.proj.fromLonLat([min_x, max_y], undefined));
                  points.push(ol.proj.fromLonLat([max_x, max_y], undefined));
                  points.push(ol.proj.fromLonLat([max_x, min_y], undefined));
                  constraint = circleConstraint;
                } else if (item.geometry_type === "rectangle") {
                  points.push(ol.proj.fromLonLat([geometry.min_longitude, geometry.min_latitude], undefined));
                  points.push(ol.proj.fromLonLat([geometry.min_longitude, geometry.max_latitude], undefined));
                  points.push(ol.proj.fromLonLat([geometry.max_longitude, geometry.max_latitude], undefined));
                  points.push(ol.proj.fromLonLat([geometry.max_longitude, geometry.min_latitude], undefined));
                  constraint = rectangleConstraint;
                } else {
                  return;
                }

                _.each(points, function(coordinates: ol.Coordinate, index) {
                  let handle = new ol.Feature({geometry: new ol.geom.Point(coordinates), resizeHandle: {item: item, index: index, constraint: constraint}, decorates: feature});
                  handle.setStyle(handleStyle);
                  handles.push(handle);
                  features.push(handle);
                });

                let decorators = feature.get("decorators") || [];
                decorators = decorators.concat(handles);
                feature.set("decorators", decorators);
              }
            });
          }
        }
      };
    }();
  }

  getFeatureStyle(feature: ol.Feature) {
    let geofence = feature.get("item");
    if (!geofence) {
      return this.tentativeStyle;
    } else if (feature.get("border")) {
      return this.geometryBorderStyle;
    } else {
      return this.targetStyle;
    }
  };

  public getItemType() {
    return "geofence";
  }

  // query items within given area
  public queryItems(min_longitude: number, min_latitude: number, max_longitude: number, max_latitude: number) {
    return this.geofenceService.queryGeofences({
        min_latitude: min_latitude,
        min_longitude: min_longitude,
        max_latitude: max_latitude,
        max_longitude: max_longitude
    }).map(data => {
      return data.map(function(geofence) {
        return new Geofence(geofence);
      });
    });
  }

  // get item with id
  public getItem(id: string) {
    return this.geofenceService.getGeofence(id).map(data => {
      return new Geofence(data);
    });
  }

  public createItemFeatures(geofence: Geofence) {
    let features = [];
    let polygon = this.createPolygonFeature(geofence.geometry_type, geofence.geometry, geofence.target.area, geofence.direction);
    let feature = new ol.Feature({geometry: polygon, item: geofence});
    features.push(feature);

    // create border
    let borderPolygon = new ol.geom.Polygon([this.createGeofenceCoordinate(geofence.geometry, geofence.geometry_type)]);
    let borderFeature = new ol.Feature({geometry: borderPolygon, item: geofence, border: geofence.geometry, decorates: feature});
    feature.set("decorators", [borderFeature]);
    features.push(borderFeature);

    return features;
  }

  createPolygonFeature(geometry_type: string, geometry: any, area: any, direction: string) {
    if (direction === "in") {
      let polygonCoordinates = this.createGeofenceCoordinate(geometry, geometry_type);
      return new ol.geom.Polygon([polygonCoordinates]);
    } else if (direction === "out") {
      // create target area
      let polygonCoordinates = this.createGeofenceCoordinate(area, "rectangle");
      let polygon = new ol.geom.Polygon([polygonCoordinates]);

      // create clip area
      let innerCoordinates = this.createGeofenceCoordinate(geometry, geometry_type);
      polygon.appendLinearRing(new ol.geom.LinearRing(innerCoordinates));
      return polygon;
    }
  }

  public createTentativeFeatures(loc: any) {
    let features = [];
    let polygonCoordinates = this.createGeofenceCoordinate(loc.geometry, loc.geometry_type);
    let polygon = new ol.geom.Polygon([polygonCoordinates]);
    let feature = new ol.Feature({geometry: polygon});
    features.push(feature);
    return features;
  }

  createGeofenceCoordinate(geometry, geometry_type) {
    let polygonCoordinates = [];

    if (geometry_type === "circle") {
      let numPoints = 60;
      let angleStep = 360 / numPoints;
      let angle = 0;
      let center = ol.proj.fromLonLat([geometry.longitude, geometry.latitude], undefined);
      let position_x = ol.proj.fromLonLat(this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 90), undefined);
      let distance_x = position_x[0] - center[0];
      let position_y = ol.proj.fromLonLat(this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius, 0), undefined);
      let distance_y = position_y[1] - center[1];
      for (let i = 0; i < numPoints; i++) {
          angle = angle + angleStep;
          polygonCoordinates.push([center[0] + distance_x * Math.cos(angle * Math.PI / 180), center[1] + distance_y * Math.sin(angle * Math.PI / 180)]);
      }
    } else if (geometry_type === "rectangle") {
      polygonCoordinates.push(ol.proj.fromLonLat([geometry.min_longitude, geometry.min_latitude], undefined));
      polygonCoordinates.push(ol.proj.fromLonLat([geometry.min_longitude, geometry.max_latitude], undefined));
      polygonCoordinates.push(ol.proj.fromLonLat([geometry.max_longitude, geometry.max_latitude], undefined));
      polygonCoordinates.push(ol.proj.fromLonLat([geometry.max_longitude, geometry.min_latitude], undefined));
      polygonCoordinates.push(polygonCoordinates[0]);
    }
    return polygonCoordinates;
  }

  public createItem(param: any) {
    return new Geofence(param);
  }

  public getHoverProps(geofence: Geofence) {
    let props = [];
    props.push({key: "direction", value: geofence.direction});
    return props;
  }

  public createGeometryFromArea(geometry_type: string, area: any, direction: string) {
    let distance_x = this.calcDistance([area.max_longitude, area.min_latitude], [area.min_longitude, area.min_latitude]);
    let distance_y = this.calcDistance([area.min_longitude, area.max_latitude], [area.min_longitude, area.min_latitude]);
    let distance = Math.min(distance_x, distance_y);

    let margin = direction === "in" ? 0 : this.AREA_MARGIN;
    if (geometry_type === "circle") {
      if (distance - margin * 2 < 0) {
        distance /= 3;
      }
      return <any>{
          longitude: (area.max_longitude + area.min_longitude) / 2,
          latitude: (area.max_latitude + area.min_latitude) / 2,
          radius: distance / 2
      };
    } else if (geometry_type === "rectangle") {
      if (distance - margin * 2 < 0) {
        margin = distance / 3 / 2;
      }
      let min_x = this.calcPosition([area.min_longitude, area.min_latitude], margin, 90)[0];
      let max_x = this.calcPosition([area.max_longitude, area.min_latitude], margin, 90)[0];
      let min_y = this.calcPosition([area.min_longitude, area.min_latitude], margin, 0)[1];
      let max_y = this.calcPosition([area.min_longitude, area.max_latitude], margin, 180)[1];
      return <any>{
          min_longitude: min_x,
          min_latitude: min_y,
          max_longitude: max_x,
          max_latitude: max_y
      };
    }
  }

  /*
  * Create a geometry of effective area for given geofence
  */
  public createTargetArea(geometry_type: string, geometry: any, direction: string) {
    let margin = direction === "in" ? 0 : this.AREA_MARGIN;
    if (geometry_type === "circle") {
      let top = this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius + margin, 0);
      let bottom = this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius + margin, 180);
      let left = this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius + margin, 270);
      let right = this.calcPosition([geometry.longitude, geometry.latitude], geometry.radius + margin, 90);
      return {
          min_longitude: left[0],
          min_latitude: bottom[1],
          max_longitude: right[0],
          max_latitude: top[1]
      };
    } else if (geometry_type === "rectangle") {
      let area0 = this.calcPosition([geometry.min_longitude, geometry.max_latitude], margin, 0);
      let area1 = this.calcPosition([geometry.max_longitude, geometry.max_latitude], margin, 90);
      let area2 = this.calcPosition([geometry.max_longitude, geometry.min_latitude], margin, 180);
      let area3 = this.calcPosition([geometry.min_longitude, geometry.min_latitude], margin, 270);
      return {
          min_longitude: area3[0],
          min_latitude: area2[1],
          max_longitude: area1[0],
          max_latitude: area0[1]
      };
    }
  }

  public hitTest(geofence, feature, position) {
    let area = geofence.target && geofence.target.area;
    if (!area) {
      return false;
    }
    let longitude = position[0];
    let latitude = position[1];
    if (area.min_longitude > longitude || longitude > area.max_longitude || area.min_latitude > latitude || latitude > area.max_latitude) {
      return false;
    }

    if (geofence.direction === "in") {
      return true;
    }

    let geometry = geofence.geometry;
    if (geofence.geometry_type === "circle") {
      return this.calcDistance([geometry.longitude, geometry.latitude], position) >= geometry.radius;
    } else {
      return geometry.min_longitude > longitude || longitude > geometry.max_longitude || geometry.min_latitude > latitude || latitude > geometry.max_latitude;
    }
  }

  /*
  * Calculate a distance between point1[longitude, latitude] and point2[longitude, latitude]
  */
  public calcDistance(point1, point2) {
    let R = 6378e3;
    let lon1 = this._toRadians(point1[0]);
    let lat1 = this._toRadians(point1[1]);
    let lon2 = this._toRadians(point2[0]);
    let lat2 = this._toRadians(point2[1]);
    let delta_x = lon2 - lon1;
    let delta_y = lat2 - lat1;
    let a = Math.sin(delta_y / 2) * Math.sin(delta_y / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(delta_x / 2) * Math.sin(delta_x / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let distance = R * c;
    return distance;
  }

  /*
  * Calculate a point[longitude, latitude] by distance meters toward bearing(0-359 degrees) far from start point[longitude, latitude]
  */
  public calcPosition(start, distance, bearing): [number, number] {
    let R = 6378e3;
    let d = distance;
    let angular_distance = d / R;
    bearing = this._toRadians(bearing);
    let s_lon = this._toRadians(start[0]);
    let s_lat = this._toRadians(start[1]);
    let sin_s_lat = Math.sin(s_lat);
    let cos_s_lat = Math.cos(s_lat);
    let cos_angular_distance = Math.cos(angular_distance);
    let sin_angular_distance = Math.sin(angular_distance);
    let sin_bearing = Math.sin(bearing);
    let cos_bearing = Math.cos(bearing);
    let sin_e_lat = sin_s_lat * cos_angular_distance + cos_s_lat * sin_angular_distance * cos_bearing;

    let e_lat = this._toDegree(Math.asin(sin_e_lat));
    let e_lon = this._toDegree(s_lon + Math.atan2(sin_bearing * sin_angular_distance * cos_s_lat,
                             cos_angular_distance - sin_s_lat * sin_e_lat));
    e_lon = (e_lon + 540) % 360 - 180;
    return [e_lon, e_lat];
  }

  _toRadians(n) {
    return n * (Math.PI / 180);
  }

  _toDegree(n) {
    return n * (180 / Math.PI);
  }
}

@Injectable()
export class Geofence extends Item {
  id: string;
  direction: string;
  geometry_type: string;
  geometry: {
    min_latitude: number,
    min_longitude: number,
    max_latitude: number,
    max_longitude: number,
    latitude: number,
    longitude: number,
    radius: number
  };
  target: {
    area: {
      min_latitude: number,
      min_longitude: number,
      max_latitude: number,
      max_longitude: number
    }
  };

  constructor(params) {
    super(params);
  }

  public getId() {
    return this.id ? this.id.toString() : null;
  }
  public getItemType() {
    return "geofence";
  }
}
