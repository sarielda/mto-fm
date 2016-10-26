/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChange, ViewChild } from '@angular/core';
import { Router } from '@angular/router';

import * as ol from 'openlayers';

import { MapHelper } from '../../shared/map-helper';
import { MapEventHelper } from '../../shared/map-event-helper';
import { EventService } from '../../shared/iota-event.service';
import { MapGeofenceHelper } from '../../shared/map-geofence-helper';
import { GeofenceService } from '../../shared/iota-geofence.service';
import { ItemToolComponent } from '../item-tool/item-tool.component';

declare var $; // jQuery from <script> tag in the index.html
// as bootstrap type definitoin doesn't extend jQuery $'s type definition

/*
 * Additional styles, javascripts
 * my css: car-monitor.css
 * OpenLayers 3.5:
 *   <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/ol3/3.5.0/ol.css" type="text/css">
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/ol3/3.5.0/ol.js"></script>
 * rx-lite 3.1.2, rxjs-dom 7.0.3:
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/rxjs/3.1.2/rx.lite.js"></script>
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/rxjs-dom/7.0.3/rx.dom.js"></script>
 */

	/**
	 * The default zoom value when the map `region` is set by `center`
	 */
let DEFAULT_ZOOM = 15;


@Component({
  moduleId: module.id,
  selector: 'fmdash-item-map',
  templateUrl: 'item-map.component.html',
  styleUrls: ['item-map.component.css']
})
export class ItemMapComponent implements OnInit {
  @Input() region: any;
  @Output() extentChanged = new EventEmitter<any>();
  @ViewChild(ItemToolComponent) itemTool: ItemToolComponent;
	// Mapping
  map: ol.Map;
  handleStyle: ol.style.Style;
  mapEventsLayer: ol.layer.Vector;
  mapGeofenceLayer: ol.layer.Vector;
  mapHelper: MapHelper;
  mapItemHelpers: any = {};
  showTool: boolean = false;
  dragging: boolean = false;
  dragFeatureCoordinate = null;
  dragStartCoordinate = null;
  dragFeature = null;
  commandExecutor = null;
  decorators: any = [];

  mapElementId = 'item-map';
  popoverElemetId = 'popover';

  constructor(
    private router: Router,
    private eventService: EventService,
    private geofenceService: GeofenceService
  ) {
  }

  initMap() {
    // drag and drop support
    let self = this;
    function interaction() {
      ol.interaction.Pointer.call(this, {
        handleDownEvent: self.onMouseDown.bind(self),
        handleDragEvent: self.onDrag.bind(self),
        handleMoveEvent: self.onMouseMove.bind(self),
        handleUpEvent: self.onMouseUp.bind(self)
      });
    };
    (<any>ol).inherits(interaction, ol.interaction.Pointer);

		// create layyers
    this.mapEventsLayer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      renderOrder: undefined
    });
    this.mapGeofenceLayer = new ol.layer.Vector({
      source: new ol.source.Vector(),
      renderOrder: undefined
    });

    // create a map
    let mouseInteration = new interaction();
    this.map =  new ol.Map({
      interactions: ol.interaction.defaults(undefined).extend([mouseInteration]),
      target: document.getElementById(this.mapElementId),
      layers: [
        new ol.layer.Tile({
          source: new ol.source.OSM(<ol.Object>{}),
          preload: 4,
        }),
        this.mapGeofenceLayer,
        this.mapEventsLayer
      ],
      view: new ol.View({
        center: ol.proj.fromLonLat((this.region && this.region.center) || [0, 0], undefined),
        zoom: ((this.region && this.region.zoom) || DEFAULT_ZOOM)
      }),
    });

    this.map.on("click", function(e) {
      let coordinate = this.mapHelper.normalizeLocation(ol.proj.toLonLat(e.coordinate, undefined));
      let loc = {longitude: coordinate[0], latitude: coordinate[1]};
      this.commandExecutor.locationClicked(loc);
    }.bind(this));

    // add helpers
    this.mapHelper = new MapHelper(this.map, function(coordinate, feature, layer) {
      let item = feature.get("item");
      if (item) {
        let helper = this.mapItemHelpers[item.getItemType()];
        if (helper && helper.hitTest) {
          return helper.hitTest(item, feature, ol.proj.toLonLat(coordinate, undefined));
        }
      }
      return true;
    }.bind(this));
    this.mapItemHelpers["event"] = new MapEventHelper(this.map, this.mapEventsLayer, this.eventService);
    this.mapItemHelpers["geofence"] = new MapGeofenceHelper(this.map, this.mapGeofenceLayer, this.geofenceService, {itemLabel: "Boundary", editable: true});

		// setup view change event handler
    this.mapHelper.postChangeViewHandlers.push(extent => {
			// fire event
      this.extentChanged.emit({extent: extent});
    });
  }

  initPopup() {
    let executor = this.commandExecutor;
    let helpers = this.mapItemHelpers;
    this.mapHelper.addPopOver({
      elm: document.getElementById(this.popoverElemetId),
      pin: true,
      updateInterval: 1000,
    },
    function showPopOver(elem, feature, pinned, closeCallback) {
      if (!feature) return;
      let content = <any>getPopOverContent(feature);
      if (content) {
        let title = '<div>' + (content.title ? _.escape(content.title) : '') + '</div>';
        let item = feature.get("item");
        if (pinned) {
          if (executor && item && content.removeable) {
            title += "<span class='btn btn-default icon-delete remove' style='margin-right:4px'></span>";
          }
          title += '<div><span class="btn btn-default close">&times;</span></div>';
        }
        let pop = $(elem).popover({
          html: true,
          title: title,
          content: content.content
        });
        if (pinned) {
          pop.on('shown.bs.popover', function(){
            let c = $(elem).parent().find('.popover .close');
            c && c.on('click', function(){
              closeCallback && closeCallback();
            });
            let r = $(elem).parent().find('.popover .remove');
            r && r.on('click', function(e) {
              let helper = helpers[item.getItemType()];
              if (helper) {
                helper.removeItemsFromView([item]);
              }
              executor && executor.deleteItem(item);
              closeCallback && closeCallback();
            });
          });
        }
        $(elem).popover('show');
      }
    },
    function destroyPopOver(elem, feature, pinned) {
      if (!feature) return;
      $(elem).popover('destroy');
    },
    function updatePopOver(elem, feature, pinned) {
      if (!feature) return;
      let content = getPopOverContent(feature);
      if (content) {
        let popover = $(elem).data('bs.popover');
        if (popover.options.content !== content.content) {
          popover.options.content = content.content;
          $(elem).popover('show');
        }
      }
    });

  	// popover - generate popover content from ol.Feature
    let getPopOverContent = (feature) => {
      let hoverContent = null;
      let content = <string>feature.get('popoverContent');
      if (content) {
        hoverContent = {content: '<span style="white-space: nowrap;">' + _.escape(content) + '</span>' };
      } else {
        let item = feature.get("item");
        if (item) {
          let helper = this.mapItemHelpers[item.getItemType()];
          if (helper) {
            let props = helper.getHoverProps(item);
            if (props && props.length > 0) {
              let title = helper.getItemLabel() + " (" + item.getId() + ")";
              let details: string = "<table><tbody>";
              props.forEach(function(prop) {
                details += "<tr><th style='white-space: nowrap;text-align:right;'><span style='margin-right:10px;'>" + _.escape(prop.key.toUpperCase()) +
                                    ":</span></th><td>" + _.escape(prop.value) + "</td></tr>";
              });
              details += "</tbody><table>";
              hoverContent = {title: title, content: details, removeable: true};
            }
          }
        }
      }
      return hoverContent;
    };
  }

  ngOnInit() {
    this.commandExecutor = this.itemTool.getCommandExecutor();
    this.initMap();
    this.region && this.mapHelper.moveMap(this.region);
    this.initPopup();
    this.itemTool.setItemMap(this);
  }

  ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
    if ("region" in changes) {
      let region = changes["region"].currentValue;
      console.log("MoveMap", region);
      this.mapHelper && this.mapHelper.moveMap(region);
    }
  }

  getMapExtent() {
    let size = this.map.getSize();
    if (!size) {
      return;
    }

    let extent:number[] = ol.proj.transformExtent(this.map.getView().calculateExtent(size), "EPSG:3857", "EPSG:4326");
    extent = this.mapHelper.normalizeExtent(extent);
    return {
      min_longitude: extent[0],
      min_latitude: extent[1],
      max_longitude: extent[2],
      max_latitude: extent[3]
    };
  }

  updateMapItems(type: string, added: any[], removed: any[]) {
    let helper = this.mapItemHelpers[type];
    if (helper) {
        let updated = false;
        if (added && added.length > 0) {
          helper.addItemsToView(added.map(function(item) {
            return helper.createItem(item);
          }));
          updated = true;
        }
        if (removed && removed.length > 0) {
          helper.removeItemsToView(added.map(function(item) {
            return helper.createItem(item);
          }));
          updated = true;
        }
        if (!updated) {
          helper.viewChanged();
        }
    }
  }

  // Event handlers
  onMouseDown(e) {
    console.log("mouse down");
    if (!this.commandExecutor) {
      return false;
    }
    let feature = e.map.forEachFeatureAtPixel(e.pixel,
        function(feature, layer) {
          return feature;
        });

    if (feature) {
      let decorates = feature.get("decorates");
      while (decorates) {
        if (feature.get("resizeHandle")) {
          break;
        }
        feature = decorates;
        decorates = feature.get("decorates");
      }
      let item = feature.get("item");
      if (item) {
        let helper = this.mapItemHelpers[item.getItemType()];
        if (helper && helper.hitTest) {
          let position = ol.proj.toLonLat(e.coordinate, undefined);
          if (!helper.hitTest(item, feature, position)) {
            return false;
          }
        }
        if (!this.commandExecutor.getMoveCommand(item, [0, 0])) {
          return false;
        }
      } else {
        let handle = feature.get("resizeHandle");
        if (!handle || !this.commandExecutor.getResizeCommand(handle.item, [0, 0], handle.index)) {
          return false;
        }
      }

      this.dragFeatureCoordinate = [e.coordinate[0], e.coordinate[1]];
      this.dragStartCoordinate = [e.coordinate[0], e.coordinate[1]];
      this.dragFeature = feature;
    }
    return !!feature;
  }

  onMouseUp(e) {
    try {
      if (!this.dragging || !this.dragFeature) {
        return;
      }

      let deltaX = e.coordinate[0] - this.dragFeatureCoordinate[0];
      let deltaY = e.coordinate[1] - this.dragFeatureCoordinate[1];

      let handle = this.dragFeature.get("resizeHandle");
      if (handle) {
        handle.constraint && handle.constraint(this.dragFeature, e.coordinate, deltaX, deltaY);
        deltaX = e.coordinate[0] - this.dragFeatureCoordinate[0];
        deltaY = e.coordinate[1] - this.dragFeatureCoordinate[1];
      } else {
        let geometry = (this.dragFeature.getGeometry());
        geometry.translate(deltaX, deltaY);
      }

      let start = ol.proj.toLonLat(this.dragStartCoordinate, undefined);
      let end = ol.proj.toLonLat(e.coordinate, undefined);
      deltaX = end[0] - start[0];
      deltaY = end[1] - start[1];
      if (deltaX === 0 && deltaY === 0) {
        return;
      }

      let item = this.dragFeature.get("item");
      if (item) {
        this.commandExecutor.moveItem(item, [deltaX, deltaY]);
      } else {
        let handle = this.dragFeature.get("resizeHandle");
        if (handle) {
          this.commandExecutor.resizeItem(handle.item, [deltaX, deltaY], handle.index);
        }
      }
    } finally {
      this.dragging = false;
      this.dragFeature = null;
      this.dragFeatureCoordinate = null;
      this.dragStartCoordinate = null;
    }
    return false;
  }

  onMouseMove(e) {
  }

  onDrag(e) {
    this.dragging = true;
    let deltaX = e.coordinate[0] - this.dragFeatureCoordinate[0];
    let deltaY = e.coordinate[1] - this.dragFeatureCoordinate[1];

    this.dragFeatureCoordinate[0] = e.coordinate[0];
    this.dragFeatureCoordinate[1] = e.coordinate[1];

    let handle = this.dragFeature.get("resizeHandle");
    if (handle) {
      handle.constraint && handle.constraint(this.dragFeature, e.coordinate, deltaX, deltaY);
    } else {
      this._moveFeature(this.dragFeature, deltaX, deltaY);
    }
  }

  _moveFeature(feature, deltaX, deltaY) {
    if (!feature) {
      return;
    }
    let geometry = feature.getGeometry();
    (<any>geometry).translate(deltaX, deltaY);

    let decorators = feature.get("decorators");
    if (decorators) {
      let self = this;
      _.each(<ol.Feature[]>decorators, function(d) {
        self._moveFeature(d, deltaX, deltaY);
      });
    }
  }

  _updateFeature() {
    let handle = this.dragFeature.get("resizeHandle");
    if (handle) {
    }
  }
}
