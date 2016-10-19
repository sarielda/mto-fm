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
import { BrowserModule }  from '@angular/platform-browser';
import { FormsModule }    from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpModule }    from '@angular/http';
import { UtilsModule } from '../utils/utils.module';

import { ItemMapComponent } from './item-map/item-map.component';
import { ItemToolComponent } from './item-tool/item-tool.component';
import { MapItemPageComponent } from './map-item-page.component';

import { routing } from './map-item-page.routing';

@NgModule({
  imports: [
    BrowserModule,
    FormsModule,
    RouterModule,
    HttpModule,
    UtilsModule,
    routing,
  ],
  declarations: [
    ItemMapComponent,
    ItemToolComponent,
    MapItemPageComponent
  ],
  exports: [
    MapItemPageComponent,
  ],
  providers: []
})
export class MapItemPageModule {}
