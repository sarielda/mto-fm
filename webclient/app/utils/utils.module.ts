/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { NgModule }      from '@angular/core';
import { BrowserModule }  from '@angular/platform-browser';
import { FormsModule }    from '@angular/forms';

import { AreaSelectComponent } from './area-select.component';

import { OrderByPipe } from './order-by.pipe';
import { MomentPipe } from './moment.pipe';

@NgModule({
  imports:      [ BrowserModule, FormsModule ],
  providers:    [  ],
  declarations: [ AreaSelectComponent, OrderByPipe, MomentPipe ],
  exports:      [ AreaSelectComponent, OrderByPipe, MomentPipe ]
})
export class UtilsModule { }
