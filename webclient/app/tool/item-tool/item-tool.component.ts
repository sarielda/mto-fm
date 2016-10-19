import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChange } from '@angular/core';
import { Router } from '@angular/router';

import { EventService } from '../../shared/iota-event.service';
import { GeofenceService } from '../../shared/iota-geofence.service';

import * as ol from 'openlayers';

declare var $; // jQuery from <script> tag in the index.html
// as bootstrap type definitoin doesn't extend jQuery $'s type definition

@Component({
  moduleId: module.id,
  selector: 'fmdash-item-tool',
  templateUrl: 'item-tool.component.html',
  styleUrls: ['item-tool.component.css']
})
export class ItemToolComponent implements OnInit {
  itemMap = null;
  supportedItems = ["event"/*, "geofence"*/];
  eventTypes = [];
  selectedEventType = null;
  eventDirections = [{label: "North", value: 0}, {label: "North East", value: 45}, {label: "East", value: 90}, {label: "South East", value: 135},
                      {label: "South", value: 180}, {label: "South West", value: 225}, {label: "West", value: 270}, {label: "North West", value: 315}];
  eventDirection: number = 0;
  geofenceTypes = [{label: "Rectangle", value: "rectangle"}, {label: "Circle", value: "circle"}];
  geofenceType: string = "rectangle";
  geofenceDirections =  [{label: "OUT", value: "out"}, {label: "IN", value: "in"}];
  geofenceDirection: string = "out";
  creationMode: string = "none";

  constructor(
    private router: Router,
    private eventService: EventService,
    private geofenceService: GeofenceService
  ) {}

  ngOnInit() {
    this.eventService.getEventTypes().subscribe(data => {
      if (data.length > 0) {
        data.sort(function(a, b) {
          return a.description && b.description && a.description.localeCompare(b.description);
        });
        this.eventTypes = data;
        this.selectedEventType = data[0];
      }
    });
  }

  onChangeMode() {
    if (this.creationMode === "event") {
      this.itemMap.map.getViewport().style.cursor = "pointer";
    } else {
      this.itemMap.map.getViewport().style.cursor = "default";
    }
  }

  onCreateGeofence() {
    let helper = this.itemMap.mapItemHelpers["geofence"];
    let extent = this.itemMap.getMapExtent();
    let offset_x = (extent.max_longitude - extent.min_longitude) / 4;
    let offset_y = (extent.max_latitude - extent.min_latitude) / 4;

    let range = null;
    if (this.geofenceType === "circle") {
      let center_x = (extent.max_longitude + extent.min_longitude) / 2;
      let center_y = (extent.max_latitude + extent.min_latitude) / 2;
      let r1 = helper.calcDistance([center_x, center_y], [center_x + offset_x, center_y]);
      let r2 = helper.calcDistance([center_x, center_y], [center_x, center_y + offset_y]);
      let radius = Math.min(r1, r2);
      range = {longitude: center_x, latitude: center_y, radius: radius};
    } else if (this.geofenceType === "rectangle") {
      range = {
        min_latitude: extent.min_latitude + offset_y,
        min_longitude: extent.min_longitude + offset_x,
        max_latitude: extent.max_latitude - offset_y,
        max_longitude: extent.max_longitude - offset_x
      };
    }
    let commandId = helper.addTentativeItem({geometry_type: this.geofenceType, geometry: range});

    return new Promise((resolve, reject) => {
      let target = {area: helper.createTargetArea(this.geofenceType, range, this.geofenceDirection)};
      return this.execute(new CreateGeofenceCommand(this.geofenceService, range, this.geofenceDirection, target)).then(function(result: any) {
        helper.setTentativeItemId(commandId, result.data.id, false);
        resolve(result);
      }, function(error) {
        helper.removeTentativeItem(commandId);
        reject(error);
      });
    });
  }

  setItemMap(itemMap) {
    this.itemMap = itemMap;
  }

  locationClicked(loc) {
    if (this.creationMode !== "event") {
      return;
    }
    let extent = this.itemMap.getMapExtent();
    let helper = this.itemMap.mapItemHelpers[this.creationMode];
    let commandId = helper.addTentativeItem(loc);
    return new Promise((resolve, reject) => {
      return this.execute(this.getLocationCommand(extent, loc)).then(function(result: any) {
        helper.setTentativeItemId(commandId, result.data, true);
        resolve(result);
      }, function(error) {
        helper.removeTentativeItem(commandId);
        reject(error);
      });
    });
  }

  moveItem(item, delta) {
    return this.execute(this.getMoveCommand(item, delta));
  }

  resizeItem(item, delta, handleIndex) {
    return this.execute(this.getResizeCommand(item, delta, handleIndex));
  }

  deleteItem(item) {
    let extent = this.itemMap.getMapExtent();
    return this.execute(this.getDeleteItemCommand(item));
  }

  execute(command) {
    return new Promise((resolve, reject) => {
      if (!command) {
        return resolve({type: this.creationMode, data: null});
      }
      command.execute().subscribe(data => {
        this.itemMap.updateMapItems(command.getCommandTarget());
        let result = {type: this.creationMode, data: data};
        resolve(result);
      }, error => {
        reject(error);
      });
    });
  }

  getCommandExecutor() {
    return this;
  }

  getLocationCommand(range, loc): ToolCommand {
    if (this.creationMode === "event") {
      return new CreateEventCommand(this.eventService, range, loc, this.selectedEventType, this.eventDirection);
    }
  }

  getMoveCommand(item, delta): ToolCommand {
    if (item.getItemType() === "geofence") {
      let geometry = item.geometry;
      if (item.geometry_type === "circle") {
        geometry.longitude += delta[0];
        geometry.latitude += delta[1];
      } else if (this.geofenceType === "rectangle") {
        geometry.min_longitude += delta[0];
        geometry.max_longitude += delta[0];
        geometry.min_latitude += delta[1];
        geometry.max_latitude += delta[1];
      }
      let target = item.target;
      if (target && target.area) {
        target.area.min_longitude += delta[0];
        target.area.max_longitude += delta[0];
        target.area.min_latitude += delta[1];
        target.area.max_latitude += delta[1];
      }
      return new UpdateGeofenceCommand(this.geofenceService, item.getId(), geometry, item.direction, target);
    }
  }

  getResizeCommand(item, delta, handleIndex) {
    if (item.getItemType() === "geofence") {
      let helper = this.itemMap.mapItemHelpers["geofence"];
      let geometry = item.geometry;
      let target = item.target;
      if (item.geometry_type === "circle") {
        let radius = geometry.radius;
        let center = [geometry.longitude, geometry.latitude];
        let edgeLonLat = helper.calcPosition(center, radius, 90);
        if (handleIndex === 0 || handleIndex === 1) {
          edgeLonLat[0] -= delta[0];
        } else {
          edgeLonLat[0] += delta[0];
        }
        geometry.radius = helper.calcDistance(center, edgeLonLat);
      } else if (item.geometry_type === "rectangle") {
        if (handleIndex === 0) {
          geometry.min_longitude += delta[0];
          geometry.min_latitude += delta[1];
        } else if (handleIndex === 1) {
          geometry.min_longitude += delta[0];
          geometry.max_latitude += delta[1];
        } else if (handleIndex === 2) {
          geometry.max_longitude += delta[0];
          geometry.max_latitude += delta[1];
        } else if (handleIndex === 3) {
          geometry.max_longitude += delta[0];
          geometry.min_latitude += delta[1];
        }
        if (geometry.min_longitude > geometry.max_longitude) {
          let lon = geometry.min_longitude;
          geometry.min_longitude = geometry.max_longitude;
          geometry.max_longitude = lon;
        }
        if (geometry.min_latitude > geometry.max_latitude) {
          let lat = geometry.min_latitude;
          geometry.min_latitude = geometry.max_latitude;
          geometry.max_latitude = lat;
        }
      }
      if (target && target.area) {
        target.area = helper.createTargetArea(item.geometry_type, geometry, item.direction);
      }
      return new UpdateGeofenceCommand(this.geofenceService, item.getId(), geometry, item.direction, target);
    }
  }

  getDeleteItemCommand(item): ToolCommand {
    if (item.getItemType() === "event") {
      return new DeleteEventCommand(this.eventService, item.event_id);
    } else if (item.getItemType() === "geofence") {
      return new DeleteGeofenceCommand(this.geofenceService, item.id);
    }
  }
}

/*
* Commands pattern to create, update and delete items
*/
export class ToolCommand {
  constructor(private commandType: string = "unknown") {
  }
  public getCommandTarget() {
    return this.commandType;
  }
  public execute() {};
}

export class CreateEventCommand extends ToolCommand {
  constructor(private eventService, private extent, private loc, private eventType, private direction) {
    super("event");
  }
  execute() {
    let date = new Date();
    let currentTime = date.toISOString();
    let params: any = {
        event_type: this.eventType.event_type,
        s_latitude: this.loc.latitude,
        s_longitude: this.loc.longitude,
        event_time: currentTime,
        start_time: currentTime,
        heading: this.direction
      };
    if (this.eventType.description) {
      params.event_name = this.eventType.description;
    }
    if (this.eventType.category) {
      params.event_category = this.eventType.category;
    }
    return this.eventService.createEvent(params);
  }
}

export class DeleteEventCommand extends ToolCommand {
  constructor(private eventService, private event_id) {
    super("event");
  }
  public execute() {
    return this.eventService.deleteEvent(this.event_id);
  }
}

export class CreateGeofenceCommand extends ToolCommand {
  constructor(private geofenceService, private geometry, private direction, private target) {
    super("geofence");
  }
  public execute() {
    let geometry_type = (!isNaN(this.geometry.radius) && !isNaN(this.geometry.latitude) && !isNaN(this.geometry.longitude)) ? "circle" : "rectangle";
    let geofence = {
      direction: this.direction,
      geometry_type: geometry_type,
      geometry: this.geometry,
    };
    if (this.target) {
      geofence["target"] = this.target;
    }
    return this.geofenceService.createGeofence(geofence);
  }
}

export class UpdateGeofenceCommand extends ToolCommand {
  constructor(private geofenceService, private geofence_id, private geometry, private direction, private target) {
    super("geofence");
  }
  public execute() {
    let geometry_type = (!isNaN(this.geometry.radius) && !isNaN(this.geometry.latitude) && !isNaN(this.geometry.longitude)) ? "circle" : "rectangle";
    let geofence = {
      direction: this.direction,
      geometry_type: geometry_type,
      geometry: this.geometry
    };
    if (this.target) {
      geofence["target"] = this.target;
    }
    return this.geofenceService.updateGeofence(this.geofence_id, geofence);
  }
}

export class DeleteGeofenceCommand extends ToolCommand {
  constructor(private geofenceService, private geofence_id) {
    super("geofence");
  }
  public execute() {
    return this.geofenceService.deleteGeofence(this.geofence_id);
  }
}
