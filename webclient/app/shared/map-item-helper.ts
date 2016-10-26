/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Injectable } from "@angular/core";
import * as ol from "openlayers";
import * as _ from "underscore";

/*
 * Abstract helper class to handle items shown on a map
*/
@Injectable()
export abstract class MapItemHelper<T extends Item> {
  loadingHandle = null;
  itemMap = {};
  tentativeItemMap = {};
  preCreatingItemMap = {};
  itemLabel: string;
  featureExtension: any = null;

  constructor(public map: ol.Map, public itemLayer: ol.layer.Vector) {
    this.map.getView().on("change:center", this.viewChanged.bind(this));
    this.map.getView().on("change:resolution", this.viewChanged.bind(this));
    setTimeout(this.updateView.bind(this), 100);
  }

  /*
  * Get a type of the item to be managed with this helper
  */
  public getItemType() {
    return "unknown";
  }

  /*
  * Set displayable label of the item to be managed with this helper
  */
  public setItemLabel(itemLabel: string) {
    this.itemLabel = itemLabel;
  }

  /*
  * Get displayable label of the item to be managed with this helper
  */
  public getItemLabel() {
    let label = this.itemLabel;
    if (!label) {
      label = this.getItemType();
      label = label.charAt(0).toUpperCase() + label.slice(1);
    }
    return label;
  }

  /*
  * callback function to be called when view position is changed
  */
  public viewChanged() {
    if (this.loadingHandle) {
      clearTimeout(this.loadingHandle);
      this.loadingHandle = null;
    }
    this.loadingHandle = setTimeout(this.updateView.bind(this), 1000);
  }

  /*
  * update view items according to the current location
  */
  public updateView() {
    let size = this.map.getSize();
    if (!size) {
      return;
    }
    let ext = this.map.getView().calculateExtent(size);
    let extent = this.normalizeExtent(ol.proj.transformExtent(ext, "EPSG:3857", "EPSG:4326"));
    this.queryItems(extent[0], extent[1], extent[2], extent[3]).subscribe(data => {
      this.updateItems(data);
    });
  }

  normalizeExtent(extent: number[]) {
    let loc1 = this.normalizeLocation([extent[0], extent[1]]);
    let loc2 = this.normalizeLocation([extent[2], extent[3]]);
    extent[0] = loc1[0];
    extent[1] = loc1[1];
    extent[2] = loc2[0];
    extent[3] = loc2[1];
    return extent;
  }

  normalizeLocation(loc: number[]) {
      let lng = loc[0] % 360;
      if (lng < -180) lng += 360;
      else if (lng > 180) lng -= 360;

      let lat = loc[1] % 180;
      if (lat < -90) lat += 180;
      else if (lat > 90) lat -= 180;

      loc[0] = lng;
      loc[1] = lat;
      return loc;
  }

  /*
  * query items shown within given area
  */
  public abstract queryItems(min_longitude: number, min_latitude: number, max_longitude: number, max_latitude: number);

  /*
  * get specific item with given id
  */
  public abstract getItem(id: string);

  /*
  * Show items on a map
  */
  public updateItems(items: T[]) {
    if (!items) {
      return;
    }

    let itemsToAdd = [];
    let itemsToRemoveMap = {};

    // back up existing items to compare with new items
    for (let key in this.itemMap) {
      itemsToRemoveMap[key] = this.itemMap[key].item;
    }

    // compare new items with existing ones and find items to be added and items to be removed
    _.each(items, function(item: T) {
      let id = item.getId();

      if (!this.itemMap[id]) {
        itemsToAdd.push(item);
      }
      if (itemsToRemoveMap[id]) {
        delete itemsToRemoveMap[id];
      }
    }.bind(this));

    // add new items
    if (itemsToAdd.length > 0) {
      this.addItemsToView(itemsToAdd);
    }

    // remove unnecessary items
    let itemsToRemove = [];
    for (let key in itemsToRemoveMap) {
      itemsToRemove.push(itemsToRemoveMap[key]);
    }
    if (itemsToRemove.length > 0) {
      this.removeItemsFromView(itemsToRemove);
    }
  }

  /*
  * Create and show a tentative feature on a map until item is created by service
  */
  public addTentativeItem(loc: any) {
    let index = null;
    for (let i = 0; i < Number.MAX_VALUE; i++) {
      index = "index" + i;
      if (!this.preCreatingItemMap[index]) {
        break;
      }
    }
    let features = this.createTentativeFeatures(loc);
    if (features) {
      this.preCreatingItemMap[index] = {features: features};
      this.itemLayer.getSource().addFeatures(features);
    }
    return index;
  }

  /*
  * Set the id assigned to new item by service. If the service doesn't return the instance with the id for a while after its creation,
  * set the monitor flag on to monitor the item get acually available
  */
  public setTentativeItemId(id: string, item_id: string, monitor: boolean = true) {
    if (item_id && !this.itemMap[item_id] && !this.tentativeItemMap[item_id]) {
      if (this.preCreatingItemMap[id]) {
        this.tentativeItemMap[item_id] = this.preCreatingItemMap[id];
        delete this.preCreatingItemMap[id];
        if (monitor) {
          this.monitorTentativeItems([item_id]);
        }
      }
    }
  }

  /*
  * Remove a tentative feature on a map. It should be called after the real item is returned by service
  */
  public removeTentativeItem(id: string) {
    let features = this.preCreatingItemMap[id] && this.preCreatingItemMap[id].features;
    if (features) {
      let self = this;
      _.each(features, function(feature: ol.Feature) {
        self.itemLayer.getSource().removeFeature(feature);
      });
      return id;
    }
    return null;
  }

  /*
  * Monitor items to be created periodically and add items when they are created by service.
  */
  monitorTentativeItems(monitoringIds) {
    let promises = [];
    if (!monitoringIds) {
      monitoringIds = _.map(<any>this.tentativeItemMap, function(value, key) { return key; });
    }
    _.each(monitoringIds, function(id) {
      promises.push(new Promise((resolve, reject) => {
        this.getItem(id).subscribe(data => {
          if (data.getId()) {
            this.addItemsToView([data]);
          }
          resolve();
        }, error => {
          if (error.statusCode !== 404) {
            delete this.tentativeItemMap[id];
          }
          resolve();
        });
      }));
    }.bind(this));

    Promise.all(promises).then(function() {
      if (Object.keys(this.tentativeItemMap).length > 0) {
        setTimeout(function() {
          this.monitorTentativeItems();
        }.bind(this), 1000);
      }
    }.bind(this));
  }

  /*
  * Add items to a map
  */
  addItemsToView(items: T[]) {
    let self = this;
    _.each(items, function(item) {
      let id = item.getId();
      if (self.tentativeItemMap[id]) {
        let features = self.tentativeItemMap[id].features;
        delete self.tentativeItemMap[id];
        if (features) {
          _.each(features, function(feature: ol.Feature) {
            self.itemLayer.getSource().removeFeature(feature);
          });
        }
      }
      if (!self.itemMap[id]) {
        let features = self.createItemFeatures(item);
        if (features) {
          if (self.featureExtension && self.featureExtension.decorate) {
            self.featureExtension.decorate(item, features);
          }
          self.itemLayer.getSource().addFeatures(features);
          self.itemMap[id] = {item: item, features: features};
        }
      }
    });
  }

  /*
  * Remove items from a map
  */
  removeItemsFromView(items: T[]) {
    let self = this;
    _.each(items, function(item) {
      let id = item.getId();
      if (self.itemMap[id]) {
        let features = self.itemMap[id].features;
        _.each(features || [], function(feature: ol.Feature) {
          if (feature)
            self.itemLayer.getSource().removeFeature(feature);
        });
        delete self.itemMap[id];
      }
    });
  }

  public abstract createItem(param: any): T;

  public abstract createItemFeatures(item: T);

  public createTentativeFeatures(loc: any) {
    return null;
  }

  public getFeatureStyle(feature: ol.Feature) {
    return this.itemLayer.getStyle();
  }

  public updateAffectedItems(ids: string[]) {
    _.each(<any>this.itemMap, function(value, key) {
      let item = value.item;
      let feature = value.features[0];
      let affected = _.contains(ids, item.getId());
      if (feature.get("affected") !== affected) {
        feature.set("affected", affected);
        feature.setStyle(this.getFeatureStyle(feature));
      }
    }.bind(this));
  }

  public getHoverProps(item: T) {
    return [];
  }
}

@Injectable()
export abstract class Item {
  constructor(params) {
    for (let key in params) {
      this[key] = params[key];
    }
  }

  public abstract getId();
  public getItemType() {
    return "unknown";
  }
}
