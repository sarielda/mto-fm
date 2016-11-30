/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, Input } from '@angular/core';
import { HttpClient } from '../../shared/http-client';
import { Response, Headers, RequestOptions } from '@angular/http';
import { Observable }     from 'rxjs/Observable';
import { OrderByPipe } from '../../utils/order-by.pipe';
import { MomentPipe } from '../../utils/moment.pipe';

@Component({
  moduleId: module.id,
  selector: 'vehicle-list',
  templateUrl: 'vehicle-list.component.html',
  styleUrls: ['../../../css/table.css', 'vehicle-list.component.css'],
})

export class VehicleListComponent {
  vehicles: Vehicle[];
  requestSending: boolean;
  orderByKey: string;
  ascendingOrder: boolean;
  numRecInPage: number;
  pageNumber: number;
  hasNext: boolean;
  isWorkingWithVehicle: boolean;
  workingVehicle: Vehicle;
  errorMessage: string;
  vendors: string[];
  selected_mo_id: string;

  constructor(private http: HttpClient) {
    this.numRecInPage = 15;
    this.pageNumber = 1;
    this.hasNext = false;
    this.isWorkingWithVehicle = false;
    this.workingVehicle = new Vehicle({});
    this.errorMessage = "";
    this.selected_mo_id = null;
  }

  ngOnInit() {
    this.selected_mo_id = null;
    this._updateVehicleList(1);
  }

  onOrderBy(key) {
    this.ascendingOrder = (key === this.orderByKey) ? !this.ascendingOrder : true;
    this.orderByKey = key;
  }

  // refresh table
  onReload(event) {
    this._updateVehicleList(1);
  }

  onNumPageChanged(num: number) {
    this.numRecInPage = num;
    this._updateVehicleList(1);
  }

  onShowPrev(event) {
      if (this.pageNumber > 1) {
        this._updateVehicleList(this.pageNumber - 1);
      }
  }

  onShowNext(event) {
    if (this.hasNext) {
      this._updateVehicleList(this.pageNumber + 1);
    }
  }

  // Open a vehicle dialog for creating
  onCreate() {
    this.requestSending = true;
    this.errorMessage = null;
    this._getVendors()
    .subscribe((vendors: Array<string>) => {
      vendors.unshift("");
      this.vendors = vendors;
      this.requestSending = false;
      this.workingVehicle = new Vehicle({});
      this.isWorkingWithVehicle = true;
    }, (error: any) => {
        this.requestSending = false;
        if (error.status === 404) { // No vendor is registered
          this.workingVehicle = new Vehicle({});
          this.isWorkingWithVehicle = true;
        }
    });
  }

  // Open a vehicle dialog for updating
  onUpdate(mo_id: string) {
    this.requestSending = true;
    this.errorMessage = null;
    this._getVendors()
    .subscribe((vendors: Array<string>) => {
      vendors.unshift("");
      this.vendors = vendors;
      this.requestSending = false;
      this.workingVehicle = new Vehicle(this._getVehicle(mo_id));
      this.isWorkingWithVehicle = true;
    }, (error: any) => {
        this.requestSending = false;
        if (error.status === 404) { // No vendor is registered
          this.workingVehicle = new Vehicle(this._getVehicle(mo_id));
          this.isWorkingWithVehicle = true;
        }
    });
  }

    // Create a vehicle
  onSubmitVehicle() {
    this.isWorkingWithVehicle = false;
    if (this.workingVehicle.mo_id) {
      this._updateVehicle(this.workingVehicle.mo_id, this.workingVehicle);
    } else {
      this._createNewVehicle(this.workingVehicle);
    }
  }

  // Cancel a vehicle creation
  onCancelVehicle() {
    this.isWorkingWithVehicle = false;
  }

  // Delete given vehicle
  onDelete(mo_id: string) {
    this._deleteVehilce(mo_id);
  }

  onToggleStatus(mo_id: string) {
      let vehicle = new Vehicle(this._getVehicle(mo_id));
      if (vehicle.status === "active") {
        vehicle.status = "inactive";
      } else {
        vehicle.status = "active";
      }
      this._updateVehicle(mo_id, vehicle);
  }

  onSyncWithIoTPlatform() {
    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this.http.post("/user/device/sync", null, null)
    .subscribe((response: Response) => {
      // Update vehicle list when succeeded
      this._updateVehicleList(1);
      if (isRequestOwner) {
        this.requestSending = false;
      }
    }, (error: any) => {
      this.errorMessage = error.message || error._body || error;
      if (isRequestOwner) {
        this.requestSending = false;
      }
    });
  }

  private _updateVehicleList(pageNumber: number) {
    let isRequestRoot = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this._getVehicles(this.numRecInPage, pageNumber)
    .subscribe((vehicles: Array<Vehicle>) => {
        this.vehicles = vehicles;
        this.pageNumber = pageNumber;
        this.hasNext = this.numRecInPage <= this.vehicles.length;
        if (isRequestRoot) {
          this.requestSending = false;
        }
    }, (error: any) => {
        if (error.status === 400) {
          alert("Thre are no more vehicles.");
        } else if (pageNumber === 1 && error.status === 404) {
          this.vehicles = [];
        } else {
          this.errorMessage = error.message || error._body || error;
        }
        this.hasNext = false;
        if (isRequestRoot) {
          this.requestSending = false;
        }
    });
  }

  // find a vehicle from list
  private _getVehicle(mo_id: string): Vehicle {
    for (let i = 0; i < this.vehicles.length; i++) {
      if (this.vehicles[i].mo_id === mo_id) {
        return this.vehicles[i];
      }
    }
    return null;
  }

  // Get vehicle list from server and update table
  private _getVehicles(numRecInPage: number, pageNumber: number) {
    let url = "/user/vehicle?num_rec_in_page=" + numRecInPage + "&num_page=" + pageNumber;
    return this.http.get(url)
      .map((response: any) => {
        let resJson = response.json();
        return resJson && resJson.data.map(function(v) {
            return new Vehicle(v);
        });
    });
  }

  // Create a vehicle with given data
  private _createNewVehicle(vehicle: Vehicle) {
    // remove internally used property
    let url = "/user/vehicle";
    let body = JSON.stringify({vehicle: vehicle.getData()});
    let headers = new Headers({"Content-Type": "application/json"});
    let options = new RequestOptions({headers: headers});

    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this.http.post(url, body, options)
    .subscribe((response: Response) => {
      // Update vehicle list when succeeded
      this._updateVehicleList(1);
      if (isRequestOwner) {
        this.requestSending = false;
      }
    }, (error: any) => {
      this.errorMessage = error.message || error._body || error;
      if (isRequestOwner) {
        this.requestSending = false;
      }
    });
  }

  // update a vehicle with given data
  private _updateVehicle(mo_id: string, vehicle: Vehicle) {
    vehicle.mo_id = mo_id;
    let url = "/user/vehicle/" + mo_id;
    let body = JSON.stringify(vehicle.getData());
    let headers = new Headers({"Content-Type": "application/json"});
    let options = new RequestOptions({headers: headers});

    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this.http.put(url, body, options)
    .subscribe((response: Response) => {
      // Update vehicle list when succeeded
      this._updateVehicleList(this.pageNumber);
      if (isRequestOwner) {
        this.requestSending = false;
      }
    }, (error: any) => {
      this.errorMessage = error.message || error._body || error;
      if (isRequestOwner) {
        this.requestSending = false;
      }
    });
  }

  // delete a vehicle
  private _deleteVehilce(mo_id: string) {
    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    this.http.delete("/user/vehicle/" + mo_id)
    .subscribe((response: Response) => {
      // Update vehicle list when succeeded
      this._updateVehicleList(1);
      if (isRequestOwner) {
        this.requestSending = false;
      }
    }, (error: any) => {
      this.errorMessage = error.message || error._body || error;
      if (isRequestOwner) {
        this.requestSending = false;
      }
    });
  }

  // Get vendor list
  private _getVendors() {
    let isRequestOwner = !this.requestSending;
    this.requestSending = true;
    this.errorMessage = null;
    let url = "/user/vendor?num_rec_in_page=50&num_page=1";
    return this.http.get(url)
    .map((response: Response) => {
      let resJson = response.json();
      return resJson && resJson.data.map(function(v) {
          return v.vendor;
      });
    });
  }
}

// Vehicle definition
class Vehicle {
  __id: string;
  mo_id: string; // The ID of the vehicle that is automatically generated by the system.
  internal_mo_id: number; // The numerical ID of the vehicle that is automatically generated by the system.
  vendor: string = ""; // The vendor ID of the vehicle that is created from within the vendor's system.
  model: string = ""; // The model of the vehicle.
  type: string = ""; // The type of the vehicle. = [ArticulatedTruck,CarWithTrailer,HighSidedVehicle,PassengerCar,Motorcycle,Bus,LightTruck,HeavyTruck,HeavyTruck_AC2,HeavyTruck_AC3,HeavyTruck_AC4,HeavyTruck_AC5,HeavyTruck_AC6,HeavyTruck_AC7,TruckWithTrailer,TruckWithTrailer_AC2,TruckWithTrailer_AC3,TruckWithTrailer_AC4,TruckWithTrailer_AC5,TruckWithTrailer_AC6,TruckWithTrailer_AC7,Unknown]
  serial_number: string = ""; // The serial number of the vehicle.
  usage: string = ""; //  The usage code of the vehicle. = [PrivateUse,Taxi,Commercial,PublicTransport,Emergency,PatrolServices,RoadOperator,SnowPlough,HazMat,Other,Unknown]
  description: string = ""; // Description of the vehicle.
  width: number; // The width of the vehicle.
  height: number; // The height of the vehicle.
  driver_id: string; // The driver ID that is created by the driver interface from within the vehicle.
  status: string = "inactive";
  properties: any;

  constructor(props) {
    for (let key in props) {
      this[key] = props[key];
    }
    this.__id = this.serial_number || this.mo_id;
  }

  getData() {
    let data = {};
    for (let key in this) {
      if (key.lastIndexOf("__", 0) !== 0) {
        data[key] = this[key];
      }
    }
    return data;
  }
}
