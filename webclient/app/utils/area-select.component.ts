/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { LocationService, MapArea } from '../shared/location.service';

@Component({
	moduleId: module.id,
	selector: 'area-select',
	templateUrl: 'area-select.component.html',
	providers: [],
})

export class AreaSelectComponent{
	@Input() DEBUG = false;
	@Input() extent: number[];
	@Output() areaChanged = new EventEmitter<number[]>();
	min_lng: string;
	min_lat: string;
	max_lng: string;
	max_lat: string;
	selectedArea: MapArea;
	areas: MapArea[];

	constructor(private locationService: LocationService) {
		this.areas = [{id: "nolocation", name: ""}].concat(locationService.getRegions());
		let mapregion = locationService.getMapRegion();
		if(mapregion && mapregion.extent){
			this.areas.push({id: "maplocation", name:"Location selected in the Map Page", extent: mapregion.extent});
		}
	}

	ngOnInit(){
		if(this.extent){
			var area = this._matchPredefinedArea();
			if(!area){
				area = this.areas.find(ares => area.id === "maplication");
				if(!area){
					area = {id: "maplocation", name:"Location selected in the Map Page", extent: this.extent};
					this.areas.push(area);
				}else{
					area.extent = this.extent;
				}
			}
			this.selectedArea = area;
		}
	}
	ngOnChanges(changes){
		if(changes.extent && changes.extent.currentValue !== changes.extent.previousValue){
			this._setAreaInput(changes.extent.currentValue);
			var area = this._matchPredefinedArea();
			this.selectedArea = area || this.areas[0];
		}
	}
	onAreaChanged(event){
		this.selectedArea = this.areas[event.target.selectedIndex];
		this.extent = this.selectedArea.extent;
		this.areaChanged.emit(this.extent);
	}
	onExtentInputChanged(event){
		switch(event.target.name){
			case "min_lng":
				this.min_lng = event.target.value;
				break;
			case "min_lat":
				this.min_lat = event.target.value;
				break;
			case "max_lng":
				this.max_lng = event.target.value;
				break;
			case "max_lat":
				this.max_lat = event.target.value;
		}
		var area = this._matchPredefinedArea();
		this.selectedArea = area || this.areas[0]; // nolocation
		if(this.min_lng !== "" && this.min_lat !== "" && this.max_lng !== "" && this.max_lat !== ""
		&& !isNaN(Number(this.min_lng)) && !isNaN(Number(this.min_lat)) && !isNaN(Number(this.max_lng)) && !isNaN(Number(this.max_lat))){
			this.extent = [Number(this.min_lng), Number(this.min_lat), Number(this.max_lng), Number(this.max_lat)];
			this.areaChanged.emit(this.extent);
		}
	}
	onClearArea(){
		this.extent = null;
		this.areaChanged.emit(this.extent);
	}
	private _setAreaInput(extent:number[]){
		if(extent){
			this.min_lng = String(extent[0]);
			this.min_lat = String(extent[1]);
			this.max_lng = String(extent[2]);
			this.max_lat = String(extent[3]);
		}else{
			this.min_lng = this.min_lat = this.max_lng = this.max_lat = "";
		}
	}
	private _matchPredefinedArea():MapArea{
		for(var i=1; i<this.areas.length; i++){ // Start from 1 because the first area is nolocation
			var area = this.areas[i];
			if(this.min_lng === String(area.extent[0])
			&& this.min_lat === String(area.extent[1])
			&& this.max_lng === String(area.extent[2])
			&& this.max_lat === String(area.extent[3])){
				return area;
			}
		}
	}
}
