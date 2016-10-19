/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { NgModule }       from '@angular/core';
import { CommonModule }   from '@angular/common';
import { BrowserModule }  from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FormsModule }    from '@angular/forms';

import { HttpModule }    from '@angular/http';
import { UtilsModule } from '../utils/utils.module';

import { CarStatusSummaryComponent } from './summary/car-status-summary.component';
import { CarListComponent } from './summary/car-list.component';
import { ChartItemComponent } from './summary/chart-item.component';
import { StatusMeterComponent } from './cards/status-meter.component';
import { StatusHistoryGrahpComponent } from './cards/status-hist-graph.component';
import { CarStatusComponent } from './car-status.component';
import { CarStatusPageComponent } from './car-status-page.component';

import { CarStatusDataService } from './summary/car-status-data.service';

import { carStatusRouting } from './car-status-page.routing';

@NgModule({
  imports: [
    CommonModule, BrowserModule, RouterModule, FormsModule,
    carStatusRouting
  ],
  declarations: [
    CarStatusSummaryComponent,
    CarListComponent,
    ChartItemComponent,
    StatusMeterComponent,
    StatusHistoryGrahpComponent,
    CarStatusComponent,
    CarStatusPageComponent
  ],
  exports: [
    CarStatusPageComponent
  ],
  // providers: [
  //   CarStatusDataService
  // ]
})
export class CarStatusPageModule {}
