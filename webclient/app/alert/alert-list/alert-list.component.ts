/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, Input, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient } from '../../shared/http-client';
import { Request, Response } from '@angular/http';

@Component({
  moduleId: module.id,
  selector: 'alert-list',
  templateUrl: 'alert-list.component.html',
  styleUrls: ['../../../css/table.css'],
  styles: [`
    .firstRow {
      padding-left: 20px;
    }

    .actionTD {
      padding: 0 20px;
    }
  `],
})

export class AlertListComponent{
  alertProps = Object.values(AlertProp.values);
  alertValues:PropValue[];

  @Input() prop = "dummy";
  @Input() value = "dummy";
  @Input() includeClosed:boolean;
  @Input() extent: number[];
  @Input() showInput = true;
  fleetalerts: Alert[];
  requestSending = false;
  selected_row_index:string;
  @ViewChild("valueSelect") valueSelect:ElementRef;

  constructor(private http: HttpClient) {  }

  ngOnInit(){
    if(!this.prop){
      this.prop = AlertProp.All.getId();
      this.alertValues = AlertProp.All.getValues();
      this.value = AlertProp.All.getValues()[0].getId();
    }else if(!this.value){
      this.value = AlertProp.All.getValues()[0].getId();
      var prop = AlertProp.values[this.prop];
      if(prop){
        this.alertValues = prop.getValues();
      }
    }
    this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
  }

  onAreaChanged(extent){
    this.extent = extent;
    this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
  }
  onPropChanged(event){
    var prop = this.alertProps[event.target.selectedIndex];
    this.prop = prop.getId();
    this.alertValues = prop.getValues();
    if(prop === AlertProp.All){
      this.value = prop.getValues()[0].getId();
      this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
    }else if(prop === AlertProp.MoId){
      this.value = "";
      this.getVehiclesForPropValue();
    }else{
      this.value = "";
      setImmediate(()=>{
        if(this.valueSelect){
          this.valueSelect.nativeElement.selectedIndex = -1;
        }
      });
    }
  }
  onValueChanged(event){
    if(event.target.tagName.toUpperCase() === "SELECT"){
      var value = this.alertValues[event.target.selectedIndex];
      this.value = value.getId();
    }else if(event.target.tagName.toUpperCase() === "INPUT"){
      this.value = event.target.value;
    }else{
      return;
    }
    this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
  }
  onIncludeClosedChanged(event){
    this.includeClosed = event.target.checked;
    this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
  }

  orderByKey: string;
  ascendingOrder: boolean;
  onOrderBy(key){
    this.ascendingOrder = (key === this.orderByKey) ? !this.ascendingOrder : true;
    this.orderByKey = key;
  }
  onMoIdClicked(event, mo_id){
    event.stopPropagation();
    this.prop = AlertProp.MoId.getId();
    this.getVehiclesForPropValue()
    this.value = mo_id;
    this.includeClosed = true;
    this.getAlert(this.prop, this.value, this.includeClosed, this.getArea());
  }
  private getAlert = function(prop:string, value:string, includeClosed?:boolean, area?:Object){
    if(!prop || !value){
      return;
    }
    var url = "/user/alert?" + prop + "=" + value + "&includeClosed=" + includeClosed + "&limit=100";
    if(area){
      url += Object.keys(area).map(function(key){return "&" + key + "=" + area[key];}).join();
    }
    this.requestSending = true;
    this.http.get(url)
    .subscribe((response: Response) => {
      this.requestSending = false;
      if(response.status == 200){
        var fleetalerts = response.json();
        this.fleetalerts = fleetalerts && fleetalerts.alerts;
        this.updateVehicleInfo();
      }
    }, (error: any) => {
      this.requestSending = false;
    });
  }
  private updateVehicleInfo(){
    var self = this;
    var moid2alerts:{key?:Alert[]} = {};
    this.fleetalerts.forEach((fleetalert, index) => {
      var alerts = moid2alerts[fleetalert.mo_id];
      if(alerts){
        alerts.push(fleetalert);
      }else{
        moid2alerts[fleetalert.mo_id] = alerts = Array<Alert>();
        alerts.push(fleetalert);
        self.http.get("/user/vehicle/" + fleetalert.mo_id)
        .subscribe((vehicleResponse:Response) => {
          var vehicle = vehicleResponse.json();
          alerts = moid2alerts[vehicle.mo_id];
          if(vehicle.serial_number){
            alerts.forEach((alert) => {
              alert.serial_number = vehicle.serial_number;
            })
          }
          delete moid2alerts[fleetalert.mo_id];
        }, (error: any) => {
          if(error.status === 404){
            console.log(fleetalert.mo_id + " may be deleted.");
          }else{
            console.error(error);
          }
        });
      }
    });
  }
  private getVehiclesForPropValue(){
    this.http.get("/user/vehicle")
    .subscribe((response:Response) => {
      var json = response.json();
      var vehicles = (json && json.data) || [];
      var vehicleExist = false;
      this.alertValues = vehicles.map((vehicle)=>{
        vehicleExist = vehicleExist || vehicle.mo_id === this.value;
        return new PropValue(vehicle.mo_id, vehicle.serial_number || vehicle.mo_id);
      }).sort((a, b) => {return <any>(a.label > b.label) - <any>(b.label > a.label)});
      if(!vehicleExist && this.value !== ""){
        this.alertValues.unshift(new PropValue(this.value, this.value));
      }
      setImmediate(()=>{
        if(this.valueSelect){
          this.valueSelect.nativeElement.value = this.value;
        }
      })
    }, (error:any) => {
      console.error(error);
    })
  }
  private getArea = function(){
    if(!this.extent || this.extent.length !== 4
    || this.extent[0] === "" || this.extent[1] === "" || this.extent[2] === "" || this.extent[3] === ""
    || isNaN(this.extent[0]) || isNaN(this.extent[1]) || isNaN(this.extent[2]) || isNaN(this.extent[3])){
      return null;
    }
    return {
      min_lng: this.extent[0],
      min_lat: this.extent[1],
      max_lng: this.extent[2],
      max_lat: this.extent[3]
    }
  }
}
class Alert {
  timestamp: string;
  mo_id: string;
  type: string;
  severity: string;
  description: string;
}
class PropValue {
  constructor(private id:string, private label:string){}
  getId(){
    return this.id;
  }
  getLabel(){
    return this.label;
  }
}
export class AlertProp {
  static values:{key?: AlertProp} = {};
  static All = new AlertProp("dummy", "All", [new PropValue("dummy", "-")]);
  static Type = new AlertProp("type", "Type", [
    // new PropValue("", "-"),
    new PropValue("low_fuel", "Low Fuel"),
    new PropValue("half_fuel", "Half Fuel"),
    new PropValue("high_engine_temp", "High Engine Temperature")
  ]);
  static Severity = new AlertProp("severity", "Severity", [
    // new PropValue("", "-"),
    new PropValue("Critical", "Critical"),
    new PropValue("High", "High"),
    new PropValue("Medium", "Medium"),
    new PropValue("Low", "Low"),
    new PropValue("Info", "Info")
  ]);
  static MoId = new AlertProp("mo_id", "Vehicle ID", []);

  constructor(private id:string, private label:string, private values:PropValue[]){
    AlertProp.values[id] = this;
  }
  getId(){
    return this.id;
  }
  getLabel(){
    return this.label;
  }
  getValues(){
    return this.values;
  }
}
