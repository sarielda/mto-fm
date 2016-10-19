/**
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the IBM License, a copy of which may be obtained at:
 *
 * http://www14.software.ibm.com/cgi-bin/weblap/lap.pl?li_formnum=L-DDIN-AEGGZJ&popup=y&title=IBM%20IoT%20for%20Automotive%20Sample%20Starter%20Apps%20%28Android-Mobile%20and%20Server-all%29
 *
 * You may not use this file except in compliance with the license.
 */
import { ModuleWithProviders }  from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { CarStatusSummaryComponent } from './summary/car-status-summary.component';
import { CarStatusComponent } from './car-status.component';
import { CarStatusPageComponent } from './car-status-page.component';

const carStatusRoutes: Routes = [
  {
    path: 'carStatus',
    component: CarStatusPageComponent,
    children: [
      { path: '',  component: CarStatusSummaryComponent },
      { path: ':mo_id', component: CarStatusComponent }
    ]
  }
];

export const carStatusRouting: ModuleWithProviders = RouterModule.forChild(carStatusRoutes);
